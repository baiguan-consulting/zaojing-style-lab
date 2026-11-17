import "server-only";

import nodemailer from "nodemailer";

type EmailConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  fromName: string;
};

function getEmailConfiguration(): EmailConfiguration {
  const host = process.env.EMAIL_SMTP_HOST?.trim();
  const port = Number(process.env.EMAIL_SMTP_PORT?.trim() || "465");
  const secure = (process.env.EMAIL_SMTP_SECURE?.trim() || "true") === "true";
  const user = process.env.EMAIL_SMTP_USER?.trim();
  const password = process.env.EMAIL_SMTP_PASSWORD?.trim();
  const fromAddress = process.env.EMAIL_FROM_ADDRESS?.trim();
  const fromName = process.env.EMAIL_FROM_NAME?.trim() || "造境 Style Lab";

  if (!host || !user || !password || !fromAddress || !Number.isInteger(port) || port < 1) {
    throw new Error("邮件服务尚未配置，请补全 EMAIL_SMTP_* 和 EMAIL_FROM_* 环境变量");
  }
  return { host, port, secure, user, password, fromAddress, fromName };
}

export async function sendLoginCode(email: string, code: string) {
  const configuration = getEmailConfiguration();
  const transporter = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    auth: {
      user: configuration.user,
      pass: configuration.password,
    },
  });

  const result = await transporter.sendMail({
    from: { name: configuration.fromName, address: configuration.fromAddress },
    to: email,
    subject: `${code} · 造境登录验证码`,
    text: `你的造境登录验证码是 ${code}。验证码 5 分钟内有效，请勿转发给他人。`,
    html: `
      <div style="margin:0;padding:36px 18px;background:#f4efe4;color:#17241e;font-family:Arial,'Microsoft YaHei',sans-serif">
        <div style="max-width:560px;margin:0 auto;padding:42px;background:#fffdf7;border-top:5px solid #eb573d">
          <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#eb573d">ZAOJING STYLE LAB</div>
          <h1 style="margin:18px 0 8px;font-size:28px">登录验证码</h1>
          <p style="margin:0;color:#6d756e;line-height:1.8">请在登录页面输入以下验证码：</p>
          <div style="margin:28px 0;padding:20px;background:#17241e;color:#fffdf7;font-size:36px;font-weight:700;letter-spacing:10px;text-align:center">${code}</div>
          <p style="margin:0;color:#6d756e;font-size:13px;line-height:1.8">验证码 5 分钟内有效，使用后立即失效。若不是你本人操作，请忽略此邮件。</p>
        </div>
      </div>
    `,
  });

  return { providerRequestId: result.messageId };
}
