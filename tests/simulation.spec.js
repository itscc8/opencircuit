const { test, expect } = require('@playwright/test')
const path = require('path')
const fs = require('fs')

const indexUrl = `file://${path.join(__dirname, '..', 'index.html')}`

function readFixture(name) {
  const file = path.join(__dirname, '..', 'fixtures', `${name}.json`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

async function gotoApp(page) {
  await page.goto(indexUrl)
  await page.waitForFunction(() => typeof window.CircuitAPI !== 'undefined')
  await page.evaluate(() => window.CircuitAPI.pause())
}

async function loadFixture(page, name) {
  const data = readFixture(name)
  await page.evaluate(() => window.CircuitAPI.reset())
  await page.evaluate((json) => window.CircuitAPI.load(json), data)
}

test.describe('Discrete tick simulation', () => {
  test('ring oscillator toggles every tick', async ({ page }) => {
    await gotoApp(page)
    await loadFixture(page, 'not_loop')

    const values = []
    for (let i = 0; i < 3; i++) {
      values.push(
        await page.evaluate(() => {
          const comp = window.CircuitAPI.readComponent('out1')
          return comp?.inputs?.[0]?.value?.toString()
        })
      )
      if (i < 2) {
        await page.evaluate(() => window.CircuitAPI.tick(1))
      }
    }

    expect(values[0]).not.toBe(values[1])
    expect(values[0]).toBe(values[2])
  })

  test('SR latch holds and resets state', async ({ page }) => {
    await gotoApp(page)
    await loadFixture(page, 'sr_latch')

    // Force known reset state first
    await page.evaluate(() => {
      window.CircuitAPI.setInput('set', 0)
      window.CircuitAPI.setInput('reset', 1)
      window.CircuitAPI.tick(4)
    })
    const qResetPrimed = await page.evaluate(
      () => window.CircuitAPI.readComponent('q')?.inputs?.[0]?.value?.toString()
    )
    expect(qResetPrimed).toBe('0')

    // Set = 1, Reset = 0
    await page.evaluate(() => {
      window.CircuitAPI.setInput('set', 1)
      window.CircuitAPI.setInput('reset', 0)
      window.CircuitAPI.tick(4)
    })
    const q1 = await page.evaluate(
      () => window.CircuitAPI.readComponent('q')?.inputs?.[0]?.value?.toString()
    )
    expect(q1).toBe('1')

    // Hold
    await page.evaluate(() => {
      window.CircuitAPI.setInput('set', 0)
      window.CircuitAPI.setInput('reset', 0)
      window.CircuitAPI.tick(2)
    })
    const qHold = await page.evaluate(
      () => window.CircuitAPI.readComponent('q')?.inputs?.[0]?.value?.toString()
    )
    expect(qHold).toBe('1')

    // Reset
    await page.evaluate(() => {
      window.CircuitAPI.setInput('set', 0)
      window.CircuitAPI.setInput('reset', 1)
      window.CircuitAPI.tick(4)
    })
    const qReset = await page.evaluate(
      () => window.CircuitAPI.readComponent('q')?.inputs?.[0]?.value?.toString()
    )
    expect(qReset).toBe('0')
  })

  test('custom component with internal oscillator toggles', async ({ page }) => {
    await gotoApp(page)
    const oscillator = readFixture('not_loop')

    const ids = await page.evaluate((json) => {
      window.CircuitAPI.reset()
      const normalizedWires =
        json.main.wires?.map((w) => ({
          fromCompId: w.from?.comp,
          fromPortId: w.from?.port,
          toCompId: w.to?.comp,
          toPortId: w.to?.port,
          bitWidth: w.bitWidth || 1,
        })) || []
      const def = {
        name: 'RING_OSC',
        components: json.main.components,
        wires: normalizedWires,
        inputs: [],
        outputs: [{ componentId: 'out1', bitWidth: 1 }],
      }
      window.CircuitAPI.registerCustomTool(def)
      const osc = new Component(2, 2, 'RING_OSC')
      const out = new Component(6, 2, 'OUTPUT')
      components.push(osc)
      components.push(out)
      wires.push(
        new Wire({
          fromCompId: osc.id,
          fromPortId: 'out0',
          toCompId: out.id,
          toPortId: 'in',
          bitWidth: 1,
        })
      )
      window.CircuitAPI.tick(1)
      return { outId: out.id }
    }, oscillator)

    const samples = await page.evaluate((outId) => {
      const vals = []
      for (let i = 0; i < 3; i++) {
        vals.push(window.CircuitAPI.readComponent(outId)?.inputs?.[0]?.value?.toString())
        window.CircuitAPI.tick(3)
      }
      return vals
    }, ids.outId)

    expect(new Set(samples).size).toBeGreaterThan(1)
  })
})
