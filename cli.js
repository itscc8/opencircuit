#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const {
  CircuitAPI,
  Component,
  Wire,
  components: runtimeComponents,
  wires: runtimeWires,
} = require('./main.js')

function printUsage() {
  console.log(`Usage: node cli.js <project.json> [--ticks N]

Run OpenCircuit headlessly in Node. The project file must be a JSON export in the OpenCircuit format.

Options:
  --ticks N   Number of simulation ticks to run after load (default: 0)

Outputs are printed for every OUTPUT component after simulation.`)
}

function parseArgs(argv) {
  const args = { file: null, ticks: 0 }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--ticks') {
      const next = argv[i + 1]
      i++
      const parsed = Number.parseInt(next, 10)
      args.ticks = Number.isNaN(parsed) ? 0 : parsed
    } else if (!args.file) {
      args.file = arg
    }
  }
  return args
}

function loadProject(filePath) {
  const abs = path.resolve(process.cwd(), filePath)
  const raw = fs.readFileSync(abs, 'utf8')
  const json = JSON.parse(raw)
  CircuitAPI.reset()
  CircuitAPI.load(json)
}

function dumpOutputs() {
  const outputs = (runtimeComponents || []).filter((c) => c.type === 'OUTPUT')
  if (!outputs.length) {
    console.log('No OUTPUT components found.')
    return
  }
  outputs.forEach((out) => {
    const val = out.inputs?.[0]?.value
    console.log(`${out.id}: ${val !== undefined ? val.toString(16) : 'undefined'}`)
  })
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.file || process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage()
    process.exit(args.file ? 0 : 1)
  }

  loadProject(args.file)
  if (args.ticks > 0) {
    CircuitAPI.tick(args.ticks)
  }
  dumpOutputs()
}

main()
