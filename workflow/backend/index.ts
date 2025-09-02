import express from 'express';
import jwt from "jsonwebtoken";

const app = express();

app.use(express.json());

const nodemailer = require("nodemailer");

// Create a test account or replace with real credentials.
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "y2kdwz@gmail.com",
    pass: "snrx yoxv xbmh hrxi ",
  },
});
//
// // Wrap in an async IIFE so we can use await.
// (async () => {
//   const info = await transporter.sendMail({
//     from: '"Maddison Foo Koch" <maddison53@ethereal.email>',
//     to: "bar@example.com, baz@example.com",
//     subject: "Hello ✔",
//     text: "Hello world?", // plain‑text body
//     html: "<b>Hello world?</b>", // HTML body
//   });
//
//   console.log("Message sent:", info.messageId);
// })();
const sendMail = async (token: string) => {
  const info = await transporter.sendMail({
    from: '"Maddison Foo Koch" <maddison53@ethereal.email>',
    to: "y2kdwz@gmail.com",
    subject: "Hello ✔",
    text: "Hello world?", // plain‑text body
    html: `<b>Hello world? http://localhost:8080/verify/${token}</b>`, // HTML body
  });


}

app.get('/', (req, res) => {
  res.status(200).send({
    "message": "Ok"
  })

})

app.get("/verify/:token", (req, res) => {
  const { token } = req.params;
  const emailid = jwt.verify(token, "adhakjsdhkajd")
  if (emailid) {
    res.status(200).send({
      "message": "access Granted"
    })
  } else {
    res.status(400).send({
      "error": "invalid JSON"
    })
  }
  console.log("email", emailid);
})

app.post('/api/v1/signup', (req, res) => {
  const { email } = req.body;
  console.log(email);
  const token = jwt.sign(email, "adhakjsdhkajd")

  sendMail(token);
  res.status(200).send({
    "message": "message sent"
  })
})

app.listen(8080, () => {
  console.log("backend started runnig.....");
}
);
