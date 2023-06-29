import * as nodemailer from "nodemailer" ;

export async function sendEmail(to: string, subject: string, msg: string) {

    const transport = nodemailer.createTransport(
        {
            host: process.env.EMAILHOST!,
            port: +process.env.EMAILPORT!,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.EMAILUSER!,
                pass: process.env.EMAILPASSWD!
            },
            logger: true
        }
    ) ;

    const info = await transport.sendMail(
        {
            from: '"XeroPartDb" <butchg@comcast.net>',
            to: to,
            subject: subject,
            html: msg
        }
    );

    console.log("mailto: '"+ info.response + "'");
}