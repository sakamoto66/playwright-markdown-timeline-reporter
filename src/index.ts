import { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import { markdown2html } from './markdown2html';

const his = (s: Date) => s.toTimeString().slice(0, 8)
const getStatus = (s: string):string => {
  const statusTbl: any = {
    passed: 'active',
    skipped: 'done',
    failed: 'crit',
    timedOut: 'crit',
  }
  const ret = statusTbl[s]
  return ret ? ret : s
}

type OutputAllTestResult = {
  [key: string]: OutputTestResult[]
}

type OutputTestResult = {
  section: string
  suiteName: string
  testName: string
  startTime: number
  duration: number
  status: string
  retry: number
}

type TestOptions = {
  outputFile?: string
  header?: string
  footer?: string
  workerGraphWidth: number
}

type WokerTimes = {
  [key: string]: WokerTime[]
}

type WokerTime = {
  time: number
  count: number
}

const vegaline = {
  $schema: "https://vega.github.io/schema/vega-lite/v4.json",
  description: "A simple line chart with embedded data.",
  width: 600,
  data: {
    values: [
      {time: "2023-01-01T08:00:00", count: 1}, 
      {time: "2023-01-01T09:00:00", count: 3},
      {time: "2023-01-01T10:00:00", count: 2}
    ]
  },
  mark: "line",
  encoding: {
    x: {
      field: "time", 
      type: "temporal", 
      title: "Time",
      axis: {
        format: "%H:%M:%S",
      }
    },
    y: {
      field: "count", 
      type: "quantitative",
      title: "Worker Count",
      axis: {tickMinStep: 1} 
    }
  }
}

class MarkdownTimelineReporter implements Reporter {
  private options:TestOptions = {workerGraphWidth:600}
  private suiteStartTime: number = 0
  private suiteEndTime: number = 0
  private testResults: OutputAllTestResult = {}
  private workerTims: WokerTime[] = []
  constructor(options: TestOptions) {
    if(options) {
      Object.assign(this.options, options)
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const startTime = result.startTime.getTime()
    const duration = result.duration
    const endTime = startTime + result.duration
    const titlePath = test.titlePath()

    const retry = result.retry
    const status = result.status
    const projectName = [titlePath.shift(), titlePath.shift()].join('')
    const testFileName = titlePath.shift()
    const testName = `${titlePath.pop()}`
    const suiteName = 0 === titlePath.length ? '>' : `${titlePath.join(' > ')}`
    const section = '' === projectName ? `${testFileName}` : `[${projectName}] ${testFileName}`

    this.suiteStartTime = 0 == this.suiteStartTime ? startTime : Math.min(this.suiteStartTime, startTime)
    this.suiteEndTime = Math.max(this.suiteEndTime, endTime)

    //add test results
    if (!this.testResults[section]) {
      this.testResults[section] = []
    }
    this.testResults[section].push({
      section, suiteName, testName, startTime, status, duration, retry
    })

    //add worker times
    this.workerTims.push({time:startTime, count:1})
    this.workerTims.push({time:startTime + duration, count:-1})
  }

  onEnd(result: FullResult) {
    const msec1min = 60 * 1000
    const lines = []
    if(this.options.header) {
      lines.push(this.options.header)
      lines.push('')
    }
    const tz = new Date().getTimezoneOffset()
    const offset = this.suiteStartTime - tz * msec1min
    const suiteEndMsec = (this.suiteEndTime - this.suiteStartTime) % msec1min
    const roundedUp = 30 * 1000 <= suiteEndMsec ? msec1min - suiteEndMsec : 0
    const suiteStartTime = new Date(this.suiteStartTime - offset)
    const suiteEndTime = new Date(this.suiteEndTime - offset + roundedUp)

    const wtimes = []
    let workerCount = 0
    this.workerTims.sort((a, b) => a.time - b.time)
    for (const wt of this.workerTims) {
      workerCount += wt.count
      const time = new Date(wt.time - offset).toISOString() // .getTime()
      if(0 < wtimes.length) {
        const beforeKey = wtimes[wtimes.length -1].time.substring(0, 19)
        const currentKey = time.substring(0, 19)
        if(beforeKey == currentKey) {
          wtimes[wtimes.length -1].count = workerCount
          continue
        }
      }
      wtimes.push({time, count: workerCount})
    }
    vegaline.width = this.options.workerGraphWidth
    vegaline.data.values = wtimes
  
    lines.push('```vega-lite')
    lines.push(JSON.stringify(vegaline, null, 2))
    lines.push('```')
    lines.push('')

    for (const section in this.testResults) {
      const tests = this.testResults[section]
      lines.push('```mermaid')
      lines.push('gantt')
      lines.push(`  title ${section}`)
      lines.push('')
      lines.push('  todayMarker off')
      lines.push('  dateFormat  HH:mm:ss')
      lines.push('  axisFormat  %H:%M')
      lines.push('  tickInterval 1minute')
      lines.push('')
      const retries = [...Array(1 + Math.max(...tests.map(t => t.retry)))].map((_, i) => i)
      retries.forEach(retry => {
        if (0 === retry) {
          lines.push(`  section Run`)
        } else {
          lines.push(`  section Retry ${retry}`)
        }

        const filteredTests = tests.filter(t => retry === t.retry)
        const suiteNames = filteredTests.map(t => t.suiteName)
        for(const suiteName of [...new Set(suiteNames)]) {
          lines.push(`    ${suiteName.replace(/[#:]/g,' ')} : milestone, ${his(suiteStartTime)}, 0s`)
          filteredTests.filter(test => suiteName === test.suiteName).forEach(({testName, status, startTime, duration}) => {
            const stt = new Date(startTime - offset)
            lines.push(`    ${testName.replace(/[#:]/g,' ')}: ${getStatus(status)}, ${his(stt)}, ${duration / 1000}s`)              
          })
        }
      })
      lines.push(`    End : milestone, ${his(suiteEndTime)}, 0s`)
      lines.push('```')
      lines.push('')
    }
    if(this.options.footer) {
      lines.push(this.options.footer)
    }
    const markdown = lines.join('\n')
    if(this.options.outputFile) {
      const outputFile = this.options.outputFile
      if(!fs.existsSync(path.dirname(outputFile))) {
        fs.mkdirSync(path.dirname(outputFile), {recursive:true})
      }
      if(/\.html?$/.test(outputFile)) {
        const title = outputFile.replace(/.*[\/\\]/, '').replace(/\..*$/, '')
        markdown2html(markdown, title).then( html => fs.writeFileSync(outputFile, html))
      } else {
        fs.writeFileSync(outputFile, markdown)
      }
      
    } else {
      console.log(markdown)
    }
  }
}

export default MarkdownTimelineReporter;

