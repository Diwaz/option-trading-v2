import { otpCache } from "./routes/auth"


setInterval(()=>{
  otpCache.forEach((value,key,map)=>{
    const elapsedTime = Date.now()-value.created
    console.log(`Elapsed Time for ${key}: ${elapsedTime}`)
    if (elapsedTime > 30000){
      map.delete(key);
    }
    console.log("whole list",map)
  })
},5000)