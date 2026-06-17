import { type User } from 'next-auth';
import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '~/env';

import { sendToDiscord } from './service-notification';

// oxlint-disable-next-line init-declarations
let transporter: Transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const host = env.EMAIL_SERVER_HOST;
  const port = parseInt(env.EMAIL_SERVER_PORT ?? '');
  const user = env.EMAIL_SERVER_USER;
  const pass = env.EMAIL_SERVER_PASSWORD;

  if (!host) {
    return;
  }

  const transport = {
    host,
    secure: 465 === port,
    port,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: 'development' !== env.NODE_ENV,
    },
  };

  transporter = nodemailer.createTransport(transport);
  return transporter;
};

export async function sendSignUpEmail(email: string, url: string, token: string) {
  const { host } = new URL(url);

  console.log(env.NODE_ENV);

  if ('development' === env.NODE_ENV) {
    console.log('Sign in link : ', email, url, token);
    return true;
  }

  const subject = 'Sign in to SplitPro';
  const text = `Hey,\n\nYou can sign in to SplitPro by clicking the below URL:\n${url}\n\nYou can also use this OTP: ${token}\n\nThanks,\nSplitPro Team`;
  const html = `<p>Hey,</p> <p>You can sign in to SplitPro by clicking the below URL:</p><p><a href="${url}">Sign in to ${host}</a></p><p>You can also use this OTP: <b>${token}</b></p><br /><br /><p>Thanks,</p><br/>SplitPro Team</p>`;

  return await sendMail(email, subject, text, html);
}

export async function sendInviteEmail(email: string, name: string) {
  if (!env.ENABLE_SENDING_INVITES) {
    throw new Error('Sending invites is not enabled');
  }

  const { host } = new URL(env.NEXTAUTH_URL);

  if ('development' === env.NODE_ENV) {
    console.log('Sending invite email', email, name);
    return;
  }

  const subject = 'Invitation to SplitPro';
  const text = `Hey,\n\nYou have been invited to SplitPro by ${name}. It's a completely open source free alternative to splitwise. You can sign in to SplitPro by clicking the below URL:\n${env.NEXTAUTH_URL}\n\nThanks,\nSplitPro Team`;
  const html = `<p>Hey,</p> <p>You have been invited to SplitPro by ${name}. It's a completely open source free alternative to splitwise. You can sign in to SplitPro by clicking the below URL:</p><p><a href="${env.NEXTAUTH_URL}">Sign in to ${host}</a></p><br><p>Thanks,<br/>SplitPro Team</p>`;

  await sendMail(email, subject, text, html);
}

export async function sendFeedbackEmail(feedback: string, user: User) {
  console.log('Received feedback from: ', user.email, 'Feedback: ', feedback);

  if (!env.FEEDBACK_EMAIL) {
    return;
  }

  const subject = `Feedback received on SplitPro from ${user.name}`;
  const text = `Feedback created by ${user.name} :\n\nFeedback: ${feedback}\n\nemail: ${user.email}`;

  await sendMail(env.FEEDBACK_EMAIL, subject, text, text, user.email ?? undefined);
}

export async function sendPaymentReminderEmail(
  email: string,
  params: {
    recipientName: string;
    payerName: string;
    expenseName: string;
    amount: string;
    expenseUrl: string;
    daysOutstanding: number;
  },
) {
  const { recipientName, payerName, expenseName, amount, expenseUrl, daysOutstanding } = params;

  const isAssertive = daysOutstanding >= 10;
  const isUrgent = daysOutstanding >= 20;

  let subject: string;
  let greeting: string;
  let body: string;
  let closing: string;

  if (daysOutstanding <= 3) {
    subject = `Friendly reminder: ${payerName} paid ${amount} for "${expenseName}"`;
    greeting = `Hey ${recipientName},`;
    body = `Just a quick heads-up — ${payerName} covered ${amount} for "${expenseName}" ${daysOutstanding === 1 ? 'yesterday' : `${daysOutstanding} days ago`} and hasn't been reimbursed yet.\n\nWhenever you get a chance, it would be great if you could settle up!`;
    closing = `No rush, but sooner is always appreciated.\n\nCheers,\nSplitPro Team`;
  } else if (daysOutstanding <= 7) {
    subject = `Reminder: You owe ${payerName} ${amount} for "${expenseName}"`;
    greeting = `Hi ${recipientName},`;
    body = `This is a gentle reminder that ${payerName} paid ${amount} for "${expenseName}" ${daysOutstanding} days ago and is still waiting to be reimbursed.\n\nPlease take a moment to settle this when you can.`;
    closing = `Thanks for your attention to this.\n\nBest,\nSplitPro Team`;
  } else if (!isAssertive) {
    subject = `Action needed: Reimburse ${payerName} ${amount} for "${expenseName}"`;
    greeting = `Hi ${recipientName},`;
    body = `A week has passed since ${payerName} paid ${amount} for "${expenseName}" on your behalf. This balance is still outstanding.\n\nWe kindly ask that you settle this payment at your earliest convenience.`;
    closing = `Please don't delay further.\n\nRegards,\nSplitPro Team`;
  } else if (!isUrgent) {
    subject = `Overdue: ${amount} owed to ${payerName} for "${expenseName}"`;
    greeting = `Hi ${recipientName},`;
    body = `${payerName} paid ${amount} for "${expenseName}" ${daysOutstanding} days ago. This payment is now significantly overdue.\n\nWe strongly urge you to reimburse ${payerName} immediately. Leaving payments unresolved for this long puts a strain on your shared finances.`;
    closing = `Please settle this today.\n\nSplitPro Team`;
  } else {
    subject = `URGENT: ${daysOutstanding}-day overdue payment of ${amount} to ${payerName}`;
    greeting = `${recipientName},`;
    body = `${payerName} paid ${amount} for "${expenseName}" ${daysOutstanding} days ago. This debt is seriously overdue and has not been addressed.\n\nYou must settle this payment immediately. ${payerName} has been waiting ${daysOutstanding} days for reimbursement — this is unacceptable and damaging to your relationship.`;
    closing = `Settle this now.\n\nSplitPro Team`;
  }

  const text = `${greeting}\n\n${body}\n\n${closing}\n\nView expense: ${expenseUrl}`;
  const html = `
    <p>${greeting}</p>
    <p>${body.replace(/\n/g, '<br/>')}</p>
    <p><a href="${expenseUrl}" style="background:#4f46e5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:8px 0;">View Expense</a></p>
    <p>${closing.replace(/\n/g, '<br/>')}</p>
  `;

  return await sendMail(email, subject, text, html);
}

async function sendMail(
  email: string,
  subject: string,
  text: string,
  html: string,
  replyTo?: string,
) {
  const transporter = getTransporter();
  try {
    if (transporter) {
      await transporter.sendMail({
        to: email,
        from: env.FROM_EMAIL,
        subject,
        text,
        html,
        replyTo,
      });

      console.log('Email sent');
      return true;
    } else {
      console.log('SMTP server not configured, so skipping');
    }
  } catch (error) {
    console.log('Error sending email', error);
    await sendToDiscord(
      `Error sending email: ${
        error instanceof Error
          ? `error.message: ${error.message}\nerror.stack: ${error.stack}`
          : 'Unknown error'
      }`,
    );
  }

  return false;
}
