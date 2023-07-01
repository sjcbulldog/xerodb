import * as nodemailer from "nodemailer" ;
import { EmailConfig, XeroDBConfig } from './config' ;
import { xeroDBLoggerLog } from "./logger";

const config = XeroDBConfig.getXeroDBConfig();

export async function sendEmail(to: string, subject: string, msg: string) {
    const e: EmailConfig = config.email();

    const transport = nodemailer.createTransport(
        {
            host: e.host,
            port: e.port,
            secure: false,
            requireTLS: true,
            auth: {
                user: e.user,
                pass: e.password
            },
            logger: true
        }
    ) ;

    try {
        const info = await transport.sendMail(
            {
                from: '"XeroPartDb" <butchg@comcast.net>',
                to: to,
                subject: subject,
                html: msg
            }
        );

        xeroDBLoggerLog('INFO', "mailto: '"+ info.response + "'");
    }
    catch(e: any) {
        let err: Error = e as Error ;
        xeroDBLoggerLog('ERROR', 'mailto: failed to send email - ' + err.message);
    }
}