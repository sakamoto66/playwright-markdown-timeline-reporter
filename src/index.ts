import { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { BrowserContext } from '@playwright/test/types/test';
import * as fs from 'fs'


const ymd = (s: Date) => s.toLocaleDateString('sv-SE')
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
  startTime: Date
  endTime: Date
  status: string
  duration: number
  retry: number
}

type TestOptions = {
  outputFile?: string
  header?: string
  footer?: string
}

class MarkdownTimelineReporter implements Reporter {
  private options:TestOptions = {}
  private suiteStartTime: number = 0
  private suiteEndTime: number = 0
  private testResults: OutputAllTestResult = {}
  constructor(options: TestOptions) {
    this.options = options ? options : {}
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const startTime = result.startTime
    const duration = result.duration
    const endTime = new Date(startTime.getTime() + result.duration)
    const titlePath = test.titlePath()

    const retry = result.retry
    const status = result.status
    const projectName = [titlePath.shift(), titlePath.shift()].join('')
    const testFileName = titlePath.shift()
    const testName = `${titlePath.pop()}`
    const suiteName = 0 === titlePath.length ? '>' : `${titlePath.join(' > ')}`
    const section = '' === projectName ? `${testFileName}` : `[${projectName}] ${testFileName}`

    this.suiteStartTime = 0 == this.suiteStartTime ? startTime.getTime() : Math.min(this.suiteStartTime, startTime.getTime())
    this.suiteEndTime = Math.max(this.suiteEndTime, endTime.getTime())
    if (!this.testResults[section]) {
      this.testResults[section] = []
    }
    this.testResults[section].push({
      section, suiteName, testName, startTime, endTime, status, duration, retry
    })
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
            const stt = new Date(startTime.getTime() - offset)
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
    if(this.options.outputFile) {
      const outputFile = this.options.outputFile
      fs.writeFileSync(outputFile, lines.join('\n'))
    } else {
      console.log(lines.join('\n'))
    }
  }
}

export default MarkdownTimelineReporter;

