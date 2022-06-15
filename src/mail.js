import nodemailer from "nodemailer";
import smtpTransport from "nodemailer-smtp-transport";
export const SendMail = (filename, buffer) => {
  let transporter = nodemailer.createTransport(
    smtpTransport({
      service: "Gmail",
      host: "smtp.gmail.com",
      port: 465,
      auth: {
        user: "edplusqa@gmail.com",
        pass: "EdPlusQA_1",
      },
    })
  );
  let mailOptions = {
    from: "edplusqa@gmail.com",
    to: "rthoraha@asu.edu,dbanala@asu.edu,sowjanya@oneorigin.us,smallik8@asu.edu",
    subject: "Cypress Automation Test Report",
    text: "PFA",
    mailParserOptions: { streamAttachments: true },
    attachments: [
      {
        filename,
        path: "./report/ASUOnline Health check results.xlsx",
        content: buffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  };
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      return console.log("error occurs", error);
    }
    console.log("Mail sent: " + info.response);
  });
};
