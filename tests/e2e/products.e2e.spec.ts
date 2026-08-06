import { test, expect, Page } from '@playwright/test'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const testImagePath = path.resolve(dirname, '../fixtures/test-product.png')

async function cleanupTestProduct(): Promise<void> {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'products',
    where: { name: { equals: 'E2E Test Product' } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'media',
    where: { alt: { equals: 'E2E Test Product' } },
    overrideAccess: true,
  })
}

test.describe('Products (admin)', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    await cleanupTestProduct()

    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
    await cleanupTestProduct()
  })

  test('logged-in admin can create a product with a photo', async () => {
    await page.goto('http://localhost:3001/admin/collections/products/create')

    await page.fill('#field-name', 'E2E Test Product')
    await page.fill('#field-price', '12.5')
    await page.fill('#field-description', 'Created by the products e2e test.')

    // Photo field: opens a Media "create new" drawer, not a bare file input
    await page.getByRole('button', { name: 'Create New' }).click()
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Select a file' }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(testImagePath)
    await page.locator('#field-alt').fill('E2E Test Product')

    // Save the media drawer, then save the product itself.
    // Both the drawer and the main form reuse id="action-save", so scope to <main>
    // and wait for the drawer to close before clicking the product's Save button.
    const drawer = page.locator('[id^="doc-drawer_media_"]')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await drawer.waitFor({ state: 'hidden' })
    await page.locator('main').getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page).toHaveURL(/\/admin\/collections\/products\/[a-zA-Z0-9-_]+/)
  })

  test('new product appears in the products list', async () => {
    await page.goto('http://localhost:3001/admin/collections/products')
    await expect(page.locator('text=E2E Test Product')).toBeVisible()
  })
})

test.describe('Products (public)', () => {
  test('anonymous visitor cannot create a product via the REST API', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/products', {
      data: {
        name: 'Should Not Be Created',
        price: 1,
        description: 'Attempted anonymous create.',
      },
    })
    expect(response.status()).toBe(403)
  })

  test('anonymous visitor can read products via the REST API', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/products')
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(Array.isArray(body.docs)).toBe(true)
  })
})
