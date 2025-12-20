const { test, expect } = require('@playwright/test')
const path = require('path')
const fs = require('fs')

const indexUrl = `file://${path.join(__dirname, '..', 'index.html')}`
const CROSSHAIR_PIXEL_THRESHOLD = 120

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

  test('dff toggles on rising clock edges', async ({ page }) => {
    await gotoApp(page)
    await loadFixture(page, 'dff_clock')

    const values = await page.evaluate(() => {
      const outId = 'out1'
      const samples = []
      for (let i = 0; i < 4; i++) {
        samples.push(
          window.CircuitAPI.readComponent(outId)?.inputs?.[0]?.value?.toString()
        )
        window.CircuitAPI.tick(1)
      }
      return samples
    })

    expect(new Set(values).size).toBeGreaterThan(1)
  })

  test('verilog export produces sanitized module', async ({ page }) => {
    await gotoApp(page)
    await page.evaluate(() => {
      window.CircuitAPI.reset()
      const inp = new Component(1, 1, 'INPUT')
      inp.id = 'in-1'
      const not = new Component(3, 1, 'NOT')
      not.id = 'not gate'
      const out = new Component(5, 1, 'OUTPUT')
      out.id = 'out-1'
      components.push(inp, not, out)
      wires.push(
        new Wire({
          fromCompId: inp.id,
          fromPortId: 'out',
          toCompId: not.id,
          toPortId: 'in',
          bitWidth: 1,
        })
      )
      wires.push(
        new Wire({
          fromCompId: not.id,
          fromPortId: 'out',
          toCompId: out.id,
          toPortId: 'in',
          bitWidth: 1,
        })
      )
    })

    const verilog = await page.evaluate(() => window.CircuitAPI.exportVerilog('my-mod'))

    expect(verilog).toContain('module my_mod(')
    expect(verilog).toContain('input in_1;')
    expect(verilog).toContain('output out_1;')
  })

  test('wire context menu omits flow toggle and probes only arm on left click', async ({
    page,
  }) => {
    await gotoApp(page)
    await page.evaluate(() => {
      window.CircuitAPI.reset()
      const a = new Component(2, 2, 'INPUT')
      const b = new Component(6, 2, 'OUTPUT')
      components.push(a, b)
      wires.push(
        new Wire({
          fromCompId: a.id,
          fromPortId: 'out',
          toCompId: b.id,
          toPortId: 'in',
          bitWidth: 1,
        })
      )
    })
    const mid = await page.evaluate(() => {
      const wire = wires[0]
      const from = components.find((c) => c.id === wire.fromCompId)
      const to = components.find((c) => c.id === wire.toCompId)
      const start = portPosition(from, from.outputs[0])
      const end = portPosition(to, to.inputs[0])
      return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
    })
    await page.evaluate(({ x, y }) => {
      window.dispatchEvent(
        new MouseEvent('contextmenu', { clientX: x, clientY: y, button: 2, bubbles: true })
      )
    }, mid)
    await expect(page.locator('#ctx-menu')).toBeVisible()
    const menuText = await page.locator('#ctx-menu').innerText()
    expect(menuText.toLowerCase()).not.toContain('flow')
    const afterRight = await page.evaluate(() => window.CircuitAPI.listProbes().length)
    expect(afterRight).toBe(0)
    await page.evaluate(() => hideContextMenu())
    await page.evaluate(({ x, y }) => {
      const canvas = document.getElementById('canvas')
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true })
      )
    }, mid)
    const afterLeft = await page.evaluate(() => window.CircuitAPI.listProbes().length)
    expect(afterLeft).toBe(1)
  })

  test('logic analyzer offsets away from hud and controls are themed', async ({
    page,
  }) => {
    await gotoApp(page)
    const left = await page.$eval(
      '#logic-analyzer',
      (el) => parseInt(getComputedStyle(el).left, 10)
    )
    expect(left).toBeGreaterThanOrEqual(180)
    const hasThemedSelect = await page.$eval('#logic-trigger-select', (el) =>
      el.classList.contains('themed-input')
    )
    expect(hasThemedSelect).toBe(true)
    const hasThemedSlider = await page.$eval('#hud input[type=\"range\"]', (el) =>
      el.classList.contains('themed-input')
    )
    expect(hasThemedSlider).toBe(true)
  })

  test('spotlight target ghost marks ctrl+k placement center', async ({ page }) => {
    await gotoApp(page)
    await page.waitForTimeout(30)
    const pixelSum = await page.evaluate(() => {
      const target = window.CircuitAPI.getSpotlightTarget()
      const cam = window.CircuitAPI.getCamera()
      const grid = 25
      const cx = Math.round(target.x * grid + cam.x + grid / 2)
      const cy = Math.round(target.y * grid + cam.y + grid / 2)
      const ctx = document.getElementById('canvas').getContext('2d')
      const data = ctx.getImageData(cx, cy, 1, 1).data
      return data[0] + data[1] + data[2]
    })
    expect(pixelSum).toBeGreaterThan(CROSSHAIR_PIXEL_THRESHOLD)
  })

  test('mode switch limits palette to basics in easy and restores in pro', async ({
    page,
  }) => {
    await gotoApp(page)
    await expect(page.locator('#hud button:has-text("RAM")')).toBeVisible()
    await page.getByRole('button', { name: 'Easy' }).click()
    await expect(page.locator('#hud button:has-text("RAM")')).toHaveCount(0)
    await page.getByRole('button', { name: 'Pro' }).click()
    await expect(page.locator('#hud button:has-text("RAM")')).toBeVisible()
  })

  test('memory primitives support load/save and runtime writes', async ({ page }) => {
    await gotoApp(page)
    await page.evaluate(() => {
      window.CircuitAPI.reset()
      const addr = new Component(1, 1, 'INPUT', { bitWidth: 2 })
      addr.id = 'addr'
      const rom = new Component(4, 1, 'ROM', { size: 4, bitWidth: 8 })
      rom.id = 'rom1'
      const out = new Component(7, 1, 'OUTPUT', { bitWidth: 8 })
      out.id = 'out'
      components.push(addr, rom, out)
      wires.push(
        new Wire({
          fromCompId: addr.id,
          fromPortId: 'out',
          toCompId: rom.id,
          toPortId: 'addr',
          bitWidth: 2,
        })
      )
      wires.push(
        new Wire({
          fromCompId: rom.id,
          fromPortId: 'data',
          toCompId: out.id,
          toPortId: 'in',
          bitWidth: 8,
        })
      )
      window.CircuitAPI.loadMemory('rom1', [0xaa, 0xbb, 0xcc, 0xdd])
      window.CircuitAPI.setInput('addr', 1)
      window.CircuitAPI.tick(2)
    })

    const romVal = await page.evaluate(() =>
      window.CircuitAPI.readComponent('out')?.inputs?.[0]?.value?.toString(16)
    )
    expect(romVal).toBe('bb')

    await page.evaluate(() => {
      window.CircuitAPI.reset()
      const addr = new Component(1, 1, 'INPUT', { bitWidth: 2 })
      addr.id = 'addr'
      const din = new Component(1, 3, 'INPUT', { bitWidth: 8 })
      din.id = 'din'
      const we = new Component(1, 5, 'INPUT', { bitWidth: 1 })
      we.id = 'we'
      const clk = new Component(1, 7, 'INPUT', { bitWidth: 1 })
      clk.id = 'clk'
      const ram = new Component(4, 2, 'RAM', { size: 4, bitWidth: 8 })
      ram.id = 'ram1'
      const out = new Component(7, 2, 'OUTPUT', { bitWidth: 8 })
      out.id = 'out'
      components.push(addr, din, we, clk, ram, out)
      wires.push(
        new Wire({
          fromCompId: addr.id,
          fromPortId: 'out',
          toCompId: ram.id,
          toPortId: 'addr',
          bitWidth: 2,
        })
      )
      wires.push(
        new Wire({
          fromCompId: din.id,
          fromPortId: 'out',
          toCompId: ram.id,
          toPortId: 'data_in',
          bitWidth: 8,
        })
      )
      wires.push(
        new Wire({
          fromCompId: we.id,
          fromPortId: 'out',
          toCompId: ram.id,
          toPortId: 'we',
          bitWidth: 1,
        })
      )
      wires.push(
        new Wire({
          fromCompId: clk.id,
          fromPortId: 'out',
          toCompId: ram.id,
          toPortId: 'clk',
          bitWidth: 1,
        })
      )
      wires.push(
        new Wire({
          fromCompId: ram.id,
          fromPortId: 'data',
          toCompId: out.id,
          toPortId: 'in',
          bitWidth: 8,
        })
      )
      window.CircuitAPI.setInput('addr', 2)
      window.CircuitAPI.setInput('din', 0x5a)
      window.CircuitAPI.setInput('we', 1)
      window.CircuitAPI.setInput('clk', 0)
      window.CircuitAPI.tick(1)
      window.CircuitAPI.setInput('clk', 1)
      window.CircuitAPI.tick(1)
      window.CircuitAPI.setInput('we', 0)
      window.CircuitAPI.tick(1)
    })

    const ramVal = await page.evaluate(() =>
      window.CircuitAPI.readComponent('out')?.inputs?.[0]?.value?.toString(16)
    )
    expect(ramVal).toBe('5a')
  })

  test('custom modules honor parameters for port widths', async ({ page }) => {
    await gotoApp(page)
    const widths = await page.evaluate(() => {
      window.CircuitAPI.reset()
      const def = {
        name: 'PARAM_PASS',
        parameters: { WIDTH: 4 },
        components: [
          { id: 'in', type: 'INPUT', gx: 0, gy: 0, properties: { bitWidth: '$WIDTH' } },
          { id: 'out', type: 'OUTPUT', gx: 2, gy: 0, properties: { bitWidth: '$WIDTH' } },
        ],
        wires: [
          {
            fromCompId: 'in',
            fromPortId: 'out',
            toCompId: 'out',
            toPortId: 'in',
            bitWidth: '$WIDTH',
          },
        ],
        inputs: [{ componentId: 'in', bitWidth: '$WIDTH' }],
        outputs: [{ componentId: 'out', bitWidth: '$WIDTH' }],
      }
      window.CircuitAPI.registerCustomTool(def)
      const inst = new Component(3, 3, 'PARAM_PASS', { parameters: { WIDTH: 8 } })
      components.push(inst)
      return {
        inWidth: inst.inputs[0].bitWidth,
        outWidth: inst.outputs[0].bitWidth,
      }
    })

    expect(widths.inWidth).toBe(8)
    expect(widths.outWidth).toBe(8)
  })

  test('named nets are tracked and design rule checks find issues', async ({ page }) => {
    await gotoApp(page)
    const result = await page.evaluate(() => {
      window.CircuitAPI.reset()
      const a = new Component(1, 1, 'INPUT')
      a.id = 'a'
      const b = new Component(4, 1, 'OUTPUT')
      b.id = 'b'
      const and = new Component(2, 3, 'AND')
      and.id = 'gate'
      components.push(a, b, and)
      const w = new Wire({
        fromCompId: a.id,
        fromPortId: 'out',
        toCompId: b.id,
        toPortId: 'in',
        bitWidth: 1,
      })
      wires.push(
        new Wire({
          fromCompId: a.id,
          fromPortId: 'out',
          toCompId: and.id,
          toPortId: 'in0',
          bitWidth: 1,
        })
      )
      wires.push(w)
      window.CircuitAPI.setNetName(w.id, 'BUS1')
      const nets = window.CircuitAPI.listNets()
      const drc = window.CircuitAPI.runDRC()
      return { netName: window.CircuitAPI.getNetName(w.id), nets, drcCount: drc.length }
    })

    expect(result.netName).toBe('BUS1')
    expect(result.nets.find((n) => n.name === 'BUS1')).toBeTruthy()
    expect(result.drcCount).toBeGreaterThan(0)
  })

  test('auto-routing produces orthogonal path data', async ({ page }) => {
    await gotoApp(page)
    const pathInfo = await page.evaluate(() => {
      window.CircuitAPI.reset()
      const a = new Component(1, 1, 'INPUT')
      a.id = 'a'
      const b = new Component(6, 5, 'OUTPUT')
      b.id = 'b'
      components.push(a, b)
      const w = new Wire({
        fromCompId: a.id,
        fromPortId: 'out',
        toCompId: b.id,
        toPortId: 'in',
        bitWidth: 1,
      })
      wires.push(w)
      applyAutoRoute(w)
      return { len: w.path?.length || 0, isGrid: !!w.pathIsGrid }
    })

    expect(pathInfo.isGrid).toBe(true)
    expect(pathInfo.len).toBeGreaterThanOrEqual(3)
  })

  test('testbench sequencer runs scripted stimuli', async ({ page }) => {
    await gotoApp(page)
    const result = await page.evaluate(() => {
      window.CircuitAPI.reset()
      const inp = new Component(1, 1, 'INPUT')
      inp.id = 'in1'
      const not = new Component(3, 1, 'NOT')
      not.id = 'inv1'
      const out = new Component(5, 1, 'OUTPUT')
      out.id = 'out1'
      components.push(inp, not, out)
      wires.push(
        new Wire({
          fromCompId: inp.id,
          fromPortId: 'out',
          toCompId: not.id,
          toPortId: 'in',
          bitWidth: 1,
        })
      )
      wires.push(
        new Wire({
          fromCompId: not.id,
          fromPortId: 'out',
          toCompId: out.id,
          toPortId: 'in',
          bitWidth: 1,
        })
      )
      const seq = [
        { at: 0, set: { in1: 0 }, expect: { out1: 1 } },
        { at: 1, set: { in1: 1 }, expect: { out1: 0 } },
      ]
      window.CircuitAPI.setTestbench(seq)
      return window.CircuitAPI.runTestbench()
    })

    expect(result.passed).toBe(true)
    expect(result.failures?.length ?? 0).toBe(0)
  })

  test('undo/redo restores component placement', async ({ page }) => {
    await gotoApp(page)
    const positions = await page.evaluate(() => {
      const project = {
        format: 'OpenCircuit',
        main: {
          components: [
            { id: 'a', type: 'INPUT', pos: { x: 1, y: 1 } },
            { id: 'b', type: 'OUTPUT', pos: { x: 4, y: 1 } },
          ],
          wires: [
            {
              from: { comp: 'a', port: 'out' },
              to: { comp: 'b', port: 'in' },
              bitWidth: 1,
            },
          ],
        },
        library: [],
      }
      window.CircuitAPI.load(project)
      const beforeComp = components.find((c) => c.id === 'a')
      const before = { gx: beforeComp?.gx, gy: beforeComp?.gy }
      window.CircuitAPI.moveComponent('a', 3, 4)
      const movedComp = components.find((c) => c.id === 'a')
      const moved = { gx: movedComp?.gx, gy: movedComp?.gy }
      window.CircuitAPI.undo()
      const afterUndo = {
        gx: components.find((c) => c.id === 'a')?.gx,
        gy: components.find((c) => c.id === 'a')?.gy,
      }
      window.CircuitAPI.redo()
      const afterRedo = {
        gx: components.find((c) => c.id === 'a')?.gx,
        gy: components.find((c) => c.id === 'a')?.gy,
      }
      return { before, moved, afterUndo, afterRedo }
    })

    expect(positions.afterUndo).toEqual(positions.before)
    expect(positions.afterRedo).toEqual(positions.moved)
  })

  test('sub-circuit dive-in edits propagate to instances', async ({ page }) => {
    await gotoApp(page)
    const values = await page.evaluate(() => {
      window.CircuitAPI.reset()
      const def = {
        name: 'MYBUF',
        components: [
          { id: 'i', type: 'INPUT', gx: 0, gy: 0, properties: { bitWidth: 1 } },
          { id: 'o', type: 'OUTPUT', gx: 2, gy: 0, properties: { bitWidth: 1 } },
        ],
        wires: [
          {
            fromCompId: 'i',
            toCompId: 'o',
            fromPortId: 'out',
            toPortId: 'in',
            bitWidth: 1,
          },
        ],
        inputs: [{ componentId: 'i', bitWidth: 1 }],
        outputs: [{ componentId: 'o', bitWidth: 1 }],
      }
      window.CircuitAPI.registerCustomTool(def)
      const inp = new Component(1, 1, 'INPUT')
      inp.id = 'top_in'
      const custom = new Component(3, 1, 'MYBUF')
      custom.id = 'inst1'
      const out = new Component(6, 1, 'OUTPUT')
      out.id = 'top_out'
      components.push(inp, custom, out)
      wires.push(
        new Wire({
          fromCompId: inp.id,
          fromPortId: 'out',
          toCompId: custom.id,
          toPortId: 'in0',
          bitWidth: 1,
        })
      )
      wires.push(
        new Wire({
          fromCompId: custom.id,
          fromPortId: 'out0',
          toCompId: out.id,
          toPortId: 'in',
          bitWidth: 1,
        })
      )
      window.CircuitAPI.setInput('top_in', 1)
      window.CircuitAPI.tick(2)
      const before = window.CircuitAPI.readComponent('top_out')?.inputs?.[0]?.value?.toString()

      window.CircuitAPI.enterCustomEdit('MYBUF')
      // Replace pass-through with inverter
      const inputComp = components.find((c) => c.id === 'i')
      const outputComp = components.find((c) => c.id === 'o')
      wires.length = 0
      const notGate = new Component(1, 1, 'NOT')
      notGate.id = 'n1'
      components.push(notGate)
      wires.push(
        new Wire({
          fromCompId: inputComp.id,
          fromPortId: 'out',
          toCompId: notGate.id,
          toPortId: 'in',
          bitWidth: 1,
        })
      )
      wires.push(
        new Wire({
          fromCompId: notGate.id,
          fromPortId: 'out',
          toCompId: outputComp.id,
          toPortId: 'in',
          bitWidth: 1,
        })
      )
      window.CircuitAPI.exitCustomEdit()
      window.CircuitAPI.setInput('top_in', 1)
      window.CircuitAPI.tick(2)
      const after = window.CircuitAPI.readComponent('top_out')?.inputs?.[0]?.value?.toString()
      return { before, after }
    })

    expect(values.before).toBe('1')
    expect(values.after).toBe('0')
  })

  test('conditional breakpoints pause when expression matches', async ({ page }) => {
    await gotoApp(page)
    await loadFixture(page, 'not_loop')

    const hitInfo = await page.evaluate(async () => {
      window.CircuitAPI.addBreakpoint('out1!=0')
      window.CircuitAPI.resume()
      await new Promise((resolve) => setTimeout(resolve, 100))
      return {
        paused: window.CircuitAPI.isPaused(),
        hit: window.CircuitAPI.listBreakpoints().some((b) => b.hitAt !== null),
      }
    })

    expect(hitInfo.hit).toBe(true)
    expect(hitInfo.paused).toBe(true)
    const bpList = await page.$('#breakpoint-list')
    expect(bpList).not.toBeNull()
  })

  test('fsm component follows transition graph', async ({ page }) => {
    await gotoApp(page)
    const outVal = await page.evaluate(() => {
      window.CircuitAPI.reset()
      const clk = new Component(1, 1, 'INPUT', { bitWidth: 1 })
      clk.id = 'clk'
      const sig = new Component(1, 3, 'INPUT', { bitWidth: 1 })
      sig.id = 'sig'
      const fsm = new Component(3, 2, 'FSM', {
        inputWidth: 1,
        fsm: {
          initial: 'IDLE',
          states: [
            { id: 'IDLE', output: 0 },
            { id: 'SEEN', output: 1 },
          ],
          transitions: [
            { from: 'IDLE', to: 'SEEN', condition: 'input!=0' },
            { from: 'SEEN', to: 'IDLE', condition: 'input==0' },
          ],
        },
      })
      fsm.id = 'fsm1'
      const out = new Component(6, 2, 'OUTPUT', { bitWidth: 1 })
      out.id = 'out'
      components.push(clk, sig, fsm, out)
      wires.push(
        new Wire({
          fromCompId: clk.id,
          fromPortId: 'out',
          toCompId: fsm.id,
          toPortId: 'clk',
          bitWidth: 1,
        })
      )
      wires.push(
        new Wire({
          fromCompId: sig.id,
          fromPortId: 'out',
          toCompId: fsm.id,
          toPortId: 'in',
          bitWidth: 1,
        })
      )
      wires.push(
        new Wire({
          fromCompId: fsm.id,
          fromPortId: 'state',
          toCompId: out.id,
          toPortId: 'in',
          bitWidth: 1,
        })
      )
      window.CircuitAPI.setInput('sig', 1)
      window.CircuitAPI.setInput('clk', 0)
      window.CircuitAPI.tick(1)
      window.CircuitAPI.setInput('clk', 1)
      window.CircuitAPI.tick(1)
      return window.CircuitAPI.readComponent('out')?.inputs?.[0]?.value?.toString()
    })

    expect(outVal).toBe('1')
    const synth = await page.evaluate(() => window.CircuitAPI.synthesizeFSM({ states: [] }))
    expect(Array.isArray(synth.components)).toBe(true)
  })

  test('assembler loads bytes into ROM and hex editor view', async ({ page }) => {
    await gotoApp(page)
    const result = await page.evaluate(() => {
      window.CircuitAPI.reset()
      const addr = new Component(1, 1, 'INPUT', { bitWidth: 2 })
      addr.id = 'addr'
      const rom = new Component(4, 1, 'ROM', { size: 4, bitWidth: 8 })
      rom.id = 'romx'
      const out = new Component(7, 1, 'OUTPUT', { bitWidth: 8 })
      out.id = 'out'
      components.push(addr, rom, out)
      wires.push(
        new Wire({
          fromCompId: addr.id,
          fromPortId: 'out',
          toCompId: rom.id,
          toPortId: 'addr',
          bitWidth: 2,
        })
      )
      wires.push(
        new Wire({
          fromCompId: rom.id,
          fromPortId: 'data',
          toCompId: out.id,
          toPortId: 'in',
          bitWidth: 8,
        })
      )
      const defs = [
        { pattern: '^NOP$', encode: 0 },
        {
          pattern: '^LOAD (?<imm>0x[0-9a-fA-F]+|\\d+)$',
          encode: (m) => parseInt(m.groups.imm),
        },
      ]
      const bytes = window.CircuitAPI.loadAssembly('romx', defs, 'NOP\nLOAD 0x5A')
      window.CircuitAPI.setInput('addr', 1)
      window.CircuitAPI.tick(2)
      return {
        b0: bytes[0],
        b1: bytes[1],
        val: window.CircuitAPI.readComponent('out')?.inputs?.[0]?.value?.toString(16),
      }
    })

    expect(result.b0).toBe(0)
    expect(result.b1).toBe(0x5a)
    expect(result.val).toBe('5a')
  })

  test('bundled buses keep width and propagate values', async ({ page }) => {
    await gotoApp(page)
    const info = await page.evaluate(() => {
      window.CircuitAPI.reset()
      const a = new Component(1, 1, 'INPUT', { bitWidth: 8 })
      a.id = 'a'
      const b = new Component(5, 1, 'OUTPUT', { bitWidth: 8 })
      b.id = 'b'
      components.push(a, b)
      wires.push(
        new Wire({
          fromCompId: a.id,
          fromPortId: 'out',
          toCompId: b.id,
          toPortId: 'in',
          bitWidth: 8,
        })
      )
      const wireId = window.CircuitAPI.getWires()[0].id
      window.CircuitAPI.bundleWire(wireId, 'DATA', 8)
      window.CircuitAPI.setInput('a', 0xaa)
      window.CircuitAPI.tick(1)
      return {
        bundle: window.CircuitAPI.listBundles()[0],
        out: window.CircuitAPI.readComponent('b')?.inputs?.[0]?.value?.toString(16),
        wire: window.CircuitAPI.getWires()[0],
      }
    })

    expect(info.bundle.width).toBe(8)
    expect(info.wire.bundle).toBe('DATA')
    expect(info.out).toBe('aa')
  })

  test('spotlight palette creates component', async ({ page }) => {
    await gotoApp(page)
    const before = await page.evaluate(() => components.length)
    await page.keyboard.press('Control+KeyK')
    await page.keyboard.type('INPUT')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(50)
    const after = await page.evaluate(
      () => components.filter((c) => c.type === 'INPUT').length
    )
    expect(after).toBeGreaterThan(before)
  })

  test('coverage heatmap tracks toggles', async ({ page }) => {
    await gotoApp(page)
    await loadFixture(page, 'not_loop')
    await page.evaluate(() => window.CircuitAPI.enableCoverage(true))
    await page.evaluate(() => window.CircuitAPI.tick(3))
    await page.waitForTimeout(50)
    const stats = await page.evaluate(() => window.CircuitAPI.getCoverageStats())
    expect(stats.some((s) => s.count > 0)).toBeTruthy()
    await page.evaluate(() => window.CircuitAPI.clearCoverage())
    const cleared = await page.evaluate(() => window.CircuitAPI.getCoverageStats())
    expect(cleared.every((s) => s.count === 0)).toBeTruthy()
  })

  test('minimap zooms to selection', async ({ page }) => {
    await gotoApp(page)
    const data = await page.evaluate(() => {
      window.CircuitAPI.reset()
      const a = new Component(2, 2, 'INPUT')
      const b = new Component(25, 10, 'OUTPUT')
      components.push(a, b)
      window.CircuitAPI.selectComponents([a.id, b.id])
      const before = window.CircuitAPI.getViewState()
      window.CircuitAPI.zoomToSelection()
      const after = window.CircuitAPI.getViewState()
      return { before, after }
    })
    expect(data.after.zoom).not.toBe(data.before.zoom)
    expect(data.after.camera.x).not.toBe(data.before.camera.x)
  })

  test('shortcut mapper rebinds toggle action', async ({ page }) => {
    await gotoApp(page)
    const ids = await page.evaluate(() => {
      window.CircuitAPI.reset()
      const inp = new Component(1, 1, 'INPUT')
      components.push(inp)
      window.CircuitAPI.selectComponents([inp.id])
      window.CircuitAPI.setShortcuts({ toggle: 't' })
      return { id: inp.id }
    })
    await page.keyboard.press('t')
    await page.waitForTimeout(30)
    const state = await page.evaluate(
      (id) => window.CircuitAPI.readComponent(id).state,
      ids.id
    )
    expect(state).toBe(true)
  })
})
