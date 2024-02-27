import { request } from '@playwright/test';

/**
 * Represents a notification fact.
 */
interface NotificationFact {
  name: string;
  value: string;
}

/**
 * Represents a section of a notification.
 */
interface NotificationSection {
  activityTitle: string;
  activitySubtitle: string;
  activityImage: string;
  facts: NotificationFact[];
  markdown: boolean;
}

/**
 * Represents the payload structure for a notification.
 */
interface NotificationPayload {
  '@type': string;
  '@context': string;
  themeColor: string;
  summary: string;
  sections: NotificationSection[];
}

export class NotificationSender {
  private async sendNotification(webhookUrl: string, payload: NotificationPayload) {
    const successMessage = 'Successfully Notification sent to Teams channel.';
    const failureMessage = 'Failed to send Notification to Teams channel.';
    const api = await request.newContext();
    try {
      const response = await api.post(webhookUrl, { data: payload });
      if (response.ok()) {
        console.info(successMessage);
      } else {
        console.error(failureMessage);
      }
    } catch (error) {
      console.error(`${failureMessage}: ${error}`);
    }
  }

  /**
   * Prepares the payload for sending a notification.
   *
   * @param _webhookUrl - The URL of the webhook.
   * @param summary - The summary of the notification.
   * @param status - The status of the notification.
   * @param exceptionMessage - The exception message (optional).
   * @returns A promise that resolves to the prepared notification payload.
   */
  private async preparePayload(
    _webhookUrl: string,
    summary: string,
    status: string,
    launchUrl: string,
  ): Promise<NotificationPayload> {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZone: 'Europe/Amsterdam',
    });

    const summaryTitle = status === 'Success' ? `Success : Test Execution Summary` : `Failed : Test Execution Summary`;

    const payload: NotificationPayload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '0076D7',
      summary: summaryTitle,
      sections: [
        {
          activityTitle: summaryTitle,
          activitySubtitle: 'Dashboard report status',
          activityImage: 'https://seeklogo.com/vector-logo/435674/playwright',
          facts: [
            {
              name: 'Environment :',
              value: process.env.URL as string,
            },
            {
              name: 'Executed date :',
              value: formatter.format(date),
            },
            {
              name: 'Status',
              value: summary,
            },
            {
              name: 'Report Portal URL :',
              value: `[Link](${launchUrl as string})`,
            },
          ],
          markdown: true,
        },
      ],
    };

    return payload;
  }

  /**
   * Sends a summary notification to a specified webhook URL.
   *
   * @param webhookUrl - The URL of the webhook to send the notification to.
   * @param summary - The summary message to include in the notification.
   * @param status - The status of the notification.
   * @returns A Promise that resolves when the notification is sent successfully.
   */
  public async sendSummaryNotification(webhookUrl: string, summary: string, status: string, launchUrl: string) {
    const payload = await this.preparePayload(webhookUrl, summary, status, launchUrl);
    await this.sendNotification(webhookUrl, payload);
  }
}
