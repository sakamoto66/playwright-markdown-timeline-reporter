import { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs'

class MyReporter implements Reporter {
  private suiteStartTime:number = 0
  private suiteEndTime:number = 0
  private json:any = {}
  onBegin(config: FullConfig, suite: Suite) {
    //suite.titlePath
    //console.log(`Starting the run with ${suite.allTests().length} tests`);
  }

  onTestBegin(test: TestCase, result: TestResult) {
    //console.log(`Starting test ${test.title}`);
  }


  onTestEnd(test: TestCase, result: TestResult) {
    const startTime = result.startTime
    const duration = result.duration
    const endTime = new Date(startTime.getTime() + result.duration)
    const titlePath = test.titlePath()
    const retry = result.retry
    const status = result.status
    const testName = titlePath.pop()
    const suiteName = titlePath.pop()
    const section = titlePath.join(' > ')

    this.suiteStartTime = 0 == this.suiteStartTime ? startTime.getTime() : Math.min(this.suiteStartTime, startTime.getTime())
    this.suiteEndTime = Math.max(this.suiteEndTime, endTime.getTime())
    if(!this.json[section]) {
      this.json[section] = {}
    }
    if(!this.json[section][suiteName]) {
      this.json[section][suiteName] = []
    }
    this.json[section][suiteName].push({
      section, suiteName, testName, startTime, endTime, status, duration, retry
    })
  }

  onEnd(result: FullResult) {
    const statusTbl = {
      passed: 'active',
      skipped: 'done',
      failed: 'crit', 
    }
    const msec1min = 60 * 1000
    const lines = []
    lines.push('## Test Timeline')
    lines.push('')
    const tz = new Date().getTimezoneOffset()
    const offset = this.suiteStartTime - tz * msec1min
    const suiteEndMsec = (this.suiteEndTime - this.suiteStartTime) % msec1min
    const roundedUp = 30 * 1000 <= suiteEndMsec ? msec1min - suiteEndMsec : 0
    const suiteStartTime = new Date(this.suiteStartTime - offset)
    const suiteEndTime = new Date(this.suiteEndTime - offset + roundedUp)
    const startLabel = dateLabel(new Date(this.suiteStartTime))
    const endLabel = dateLabel(new Date(this.suiteEndTime))
    for(const section in this.json) {
      const suites = this.json[section]
      lines.push('```mermaid')
      lines.push('gantt')
      lines.push(`  title ${section}`)
      lines.push('')
      lines.push('  todayMarker off')
      lines.push('  dateFormat  HH:mm:ss')
      lines.push('  axisFormat  %H:%M')
      lines.push('  tickInterval 1minute')
      lines.push('')
      for(const suite in suites) {
        const tests = suites[suite]
        lines.push(`  section Describe`)
        lines.push(`    "${suite}" : milestone, ${his(suiteStartTime)}, 1min`)
        const retries = [...Array(1 + Math.max(...tests.map(t => t.retry)))].map((_, i) => i)
        retries.forEach( retry => {
          if(0===retry) {
            lines.push(`  section Run`)
          } else {
            lines.push(`  section Retry ${retry}`)
          }
          tests.filter(t => retry === t.retry).forEach(({testName, startTime, endTime, status, duration}) => {
            const stt = new Date(startTime.getTime() - offset)
            lines.push(`    "${testName}": ${statusTbl[status]}, ${his(stt)}, ${duration / 1000}s`)
          })
        })
      }
      lines.push(`  section End`)
      lines.push(`    E : milestone, ${his(suiteEndTime)}, 1min`)
      lines.push('```')
      lines.push('')
    }
    const fpath = 'test-result.md'
    fs.writeFileSync(fpath, lines.join('\n'))
    //console.log(`Finished the run: ${result.status}`);
  }
}

export default MyReporter;

const ymd = (s) => s.toLocaleDateString('sv-SE')
const his = (s) => s.toTimeString().slice(0, 8)
const dateLabel = (s) => s.toLocaleDateString('sv-SE') + ' ' + s.toTimeString().slice(0, 8).replace(/\:/g,'_')

function getDuration(startTime, endTime) {
  const ms = endTime.getTime() - startTime.getTime()
  const dms = ms % 1000
  const sec = (ms - dms)/ 1000
  const ds = sec % 60
  const dm = (sec - ds) / 60
  return `${dm}m ${ds}s`
}
