import {Router} from 'express';
import { TOTP } from "totp-generator"
import nodemailer from 'nodemailer';
import { otpEmailHTML } from '../helper/sendMail';
import type { OtpWrapper } from '../types/types';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '../generated/prisma/client';
import { PerMinRateLimit } from '../helper/rateLimit';




const authRoutes = Router();
const prisma = new PrismaClient();
export const otpCache = new Map<string,OtpWrapper>();


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, 
  auth: {
    user: "y2kdwz@gmail.com",
    pass: process.env.SMTP_PASS,
  },
});

const sendMail = async (email: string,htmlBody:string) => {
  const info = await transporter.sendMail({
    from: '"Diwas Bhandari" <y2kdwz@gmail.com>',
    to: email,
    subject: "Login OTP for 100xTrade",
    html: htmlBody, // HTML body
  });


}


authRoutes.post('/initiate_login',PerMinRateLimit,async (req,res)=>{
    const {email} = req.body;
    if (!email){
        return res.status(400).json({
            error:"Invalid Input"
        })
    }
    const {otp} = await TOTP.generate(process.env.JWT_SECRET ?? " ",{digits:6})
    console.log("otp",otp);
    const otpBody = {
      created: Date.now(),
      otp
    }
    otpCache.set(email,otpBody);

    
    if (process.env.ENVIRONMENT === 'PRODUCTION'){
    const htmlBody = otpEmailHTML(otp,email);
    sendMail(email,htmlBody)
    }

    console.log("mail sent")
      try {
      await prisma.user.create({
        data: {
          email
        }
      })
    } catch(e){
        console.log("User already exist")
    }

    return res.status(200).json({
      success:'OTP generated and sent successfully!'
    }) 
})

authRoutes.post('/login',async (req,res)=>{
  const {email,otp} = req.body;

  if (!email || !otp){
    return res.status(400).json({
      error:"Invalid Input"
    })
  }

  const getUserOtp = otpCache.get(email);
  if (!getUserOtp){
    return res.status(400).json({
      error:"No Records Found!"
    })
  }

  if (getUserOtp.otp != otp){
    return res.status(400).json({
      error:"Invalid or Expired OTP"
    })
  }

   const user =  await prisma.user.findUnique({
      where:{
        email
      }
    })

    if (!user){
      return res.status(400).json({
        error:"User Not Found!"
      })
    }
  const token = jwt.sign({email:email,userId:user.id},process.env.JWT_SECRET ?? " ");

 res.status(200).json({
  token
 }) 


})


export default authRoutes;