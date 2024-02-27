import { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { NotificationSender } from './notificationSender';
import axios from 'axios';
import { RPconfig } from './../../playwright.config';
/**
 * Calculates the duration between a start time and an end time.
 * @param startTime - The start time in milliseconds.
 * @param endTime - The end time in milliseconds.
 * @returns The duration in milliseconds.
 */
function getDuration(startTime: number, endTime: number): number {
  return endTime - startTime;
}
const RPClient = require('@reportportal/client-javascript');

/**
 * Formats the duration in milliseconds into a string representation of minutes and seconds.
 * @param duration - The duration in milliseconds.
 * @returns The formatted duration string in the format "Xm Ys".
 */
function formatDuration(duration: number): string {
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${Math.max(minutes, 0)}m ${Math.abs(seconds)}s`;
}

/**
 * Represents the summary result object.
 */
type SummaryResult = {
  [key: string]: string;
};

/**
 * Represents a custom report for test execution.
 */
class SummaryReport implements Reporter {
  private testResults: SummaryResult = {};
  private suiteStartTime: number = 0;
  private suiteEndTime: number = 0;
  private notificationSender: NotificationSender;
  private notifications: Promise<void>[] = [];
  private failCount = 0;
  private passCount = 0;
  private launchUrl;
  constructor() {
    this.notificationSender = new NotificationSender();
  }

  /**
   * Sends a notification to a webhook URL with the specified summary and status.
   * If the status is not 'Success', it sends a failure notification.
   * @param webhookUrl The URL of the webhook to send the notification to.
   * @param summary The summary of the notification.
   * @param status The status of the notification.
   * @returns A promise that resolves when the notification is sent.
   */
  private async sendNotification(
    webhookUrl: string,
    summary: string,
    status: string,
    launchUrl: string,
  ): Promise<void> {
    // Uncomment the following line to send a notification whenever a test finishes, regardless of whether it passed or failed.
    // if (status !== 'Success')
      this.notifications.push(this.notificationSender.sendSummaryNotification(webhookUrl, summary, status, launchUrl));
  }

  /**
   * Called when a test ends.
   * @param test - The test case.
   * @param result - The test result.
   */
  onTestEnd(test: TestCase, result: TestResult): void {
    this.testResults[test.id] = test.outcome();
    const startTime = result.startTime.getTime();
    this.suiteStartTime = this.suiteStartTime === 0 ? startTime : Math.min(this.suiteStartTime, startTime);

    if (result.status !== 'passed') {
      this.failCount++;
    } else {
      this.passCount++;
    }
  }

  /**
   * Handles the end of the test execution.
   * @param _result - The result of the test execution.
   * @returns A promise that resolves when the handling is complete.
   */
  async onEnd(_result: FullResult): Promise<void> {
    await this.getLaunchURL();
    let all = 0;
    const outcome: any = {
      skipped: 0,
      expected: 0,
      unexpected: 0,
      flaky: 0,
    };

    for (const id in this.testResults) {
      all++;
      const status = this.testResults[id];
      if (!outcome[status]) {
        outcome[status] = 0;
      }
      outcome[status]++;
    }

    const duration = getDuration(this.suiteStartTime, this.suiteEndTime);
    const durationString = formatDuration(duration);

    const summary = `
    Execution Summary:
     ✅ Total Test Cases: ${all} 
     ✅ Passed: ${outcome['expected']}
     ❌ Failed: ${outcome['unexpected']} 
     ⚠ Flaky: ${outcome['flaky']} 
     ⏭ Skipped: ${outcome['skipped']} 
     ⏱ Duration: ${durationString}
    `;

    await this.sendNotification(
      'YOUR_WEBHOOK_URL',
      summary,
      this.failCount === 0 ? 'Success' : 'Fail',
      this.launchUrl,
    );

    await Promise.all(this.notifications);
  }

  /**
   * Retrieves the launch URL for the current RPClient configuration.
   * @returns {Promise<void>} A promise that resolves once the launch URL is retrieved.
   */
  private async getLaunchURL() {
    const rpClient = new RPClient({
      apiKey: RPconfig.apiKey,
      endpoint: RPconfig.endpoint,
      project: RPconfig.project,
    });

    try {
      const response = await rpClient.checkConnect();
      console.info('You have successfully connected to the Report Portal server.');
      console.info(`You are using an account: ${response.fullName}`);

      const launchesResponse = await axios.get(`${rpClient.config.endpoint}/${rpClient.config.project}/launch`, {
        headers: {
          Authorization: `Bearer ${rpClient.config.apiKey}`,
        },
      });

      const launches = launchesResponse.data.content;
      const latestLaunch = launches.sort((a, b) => b.id - a.id)[0];
      const baseUrl = RPconfig.endpoint.replace('/api/v1', '');
      this.launchUrl = `${baseUrl}/ui/#${rpClient.config.project}/launches/all/${latestLaunch.id}`;
      console.info(`Launch URL: ${this.launchUrl}`);
    } catch (error) {
      console.info('Error connection to server');
    }
  }
}

export default SummaryReport;
