# playwright-markdown-timeline-reporter

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

playwright-markdown-timeline-reporter is a library that generates Markdown Gantt charts to visualize test timelines for test results obtained using Playwright. It simplifies the visualization and understanding of test progress and dependencies.

## Features

- Generate Markdown Gantt charts: Generate Gantt charts in Markdown format based on the test results obtained from Playwright. The charts represent each test case as a bar, showing the start and end times. Test case dependencies are visually displayed using connecting lines.

- Customizable output: Customize the appearance of the generated Gantt charts. Adjust parameters such as colors, fonts, and bar heights to create output that matches your preferences.

- Filter and sort test results: Filter and sort test results based on specific criteria. This allows you to focus on relevant information and set the priority of test cases.

## Usage

1. Install the playwright-markdown-timeline-reporter library:

```shell
npm install playwright-markdown-timeline-reporter
```

2. Import the library and retrieve the test results:

```javascript
const playwrightMarkdownTimelineReporter = require('playwright-markdown-timeline-reporter');

// Retrieve test results using Playwright and store them in the `testResults` variable

// Generate the Gantt chart
const ganttChart = playwrightMarkdownTimelineReporter.generateGanttChart(testResults);
console.log(ganttChart);
```

For detailed examples and API documentation, please refer to the GitHub repository.

## License

This project is licensed under the MIT License. See the [LICENSE](https://chat.openai.com/LICENSE) file for details.
