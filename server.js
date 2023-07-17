require('dotenv').config()
const express =require("express");
const _=require("lodash")
const mongoose=require("mongoose");
const app=express();
const bcrypt=require('bcryptjs')
const nodemailer=require('nodemailer');
const bodyparser=require("body-parser");
app.use(bodyparser.urlencoded({extended:true}));
app.use(express.json());
const session=require('express-session');
const passport=require('passport');
const cors=require('cors')
const passportLocalMongoose=require('passport-local-mongoose');
const jwt = require('jsonwebtoken');
app.use(cors());
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    // cookie: { secure: true }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static("public"));

let transport = nodemailer.createTransport({
    host:"sandbox.smtp.mailtrap.io",
    port:2525,
    // requireTLS:true,
    // service:"outlook",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS
    }
});
mongoose.connect(process.env.MONGO_DB_CONNECTION_STRING)

const userSchema=new mongoose.Schema({
    name:String,
    _id:String,
    password: String,
    submittedCodes: [String]
}) 
const submissionSchema=new mongoose.Schema({
    code:String,
    _id: String,
    custIn: String,
    toDis: String,
    language: String,
    byUser: String,
    cnt: Number
})
userSchema.plugin(passportLocalMongoose);

const User=new mongoose.model("User",userSchema);
const submissions=new mongoose.model("submissions",submissionSchema);
submissions.findOne({_id:'hehe'},function(err,sub){
    if(!err)
    {
        if(!sub)
        {
            const initialCount=new submissions({
                _id:"hehe",
                cnt: 10000
            })
            initialCount.save((err)=>{
                if(err) console.log(err);
            })
        }
    }
})


passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.post("/login",function(req,res){
    const{email,password}=req.body
    User.findOne({_id:email},async function(err,user){
        if(!err)
        {
            if(!user)
            res.send({message:"User not registered"})
            else{
                let match=await bcrypt.compare(password,user.password);
                if(match){
                    let token=jwt.sign({user},process.env.JWT_SECRET,{expiresIn: "5s"});
                    let refreshtoken=jwt.sign({user},process.env.REFRESH_TOKEN_SECRET);
                    // console.log(token)
                    res.send({message:"Login Successfull",user:user,token:token,retoken:refreshtoken})
                }
                else
                    res.send({message: "Incorrect Password"})
            }
        }
    })
    
})
app.post("/updatepassword",async function(req,res){
    const {email,newPassword}=req.body
    const saltedHash=await bcrypt.hash(newPassword,10)
    User.findOneAndUpdate({_id:email},{$set:{password: saltedHash}},function(err,user){
        if(err)
        res.send({message:"There was an error. Please try again"});
        else
        res.send({message:"Password Reset Successfull. Please Login"})
    })
})
app.post("/checkuser&sendCode",function(req,res){
    const {email,code}=req.body
    User.findOne({_id:email},async function(err,user){
        if(!err)
        {
            if(!user)
            res.send({message:"This e-Mail has not been registered",status:false})
            else
            {
                let msg= 'The Verification Code is '+String(code)+'\nIgnore if you did not request this.'+'\n\nRegards,\nTeam LetsCode';
                const message={
                    from: 'letselectronics.ace@outlook.com',
                    to: email,
                    subject: 'Reset Password',
                    text:msg
                    // html:"<div>The Verifica</div>"
                }
                transport.sendMail(message,function(err,info){
                    if(err){
                        console.log(err)
                    }
                    else{
                        console.log(info)
                    }
                })
                res.send({message: "Code has been Sent to your e-Mail",status:true})
            }
        }
    })
})
app.post("/check",function(req,res,next){
    const {token}=req.body;
    if(token===undefined||req.body===undefined)
    res.send({messgae:404})
    else
    {
        const user=jwt.verify(token,process.env.REFRESH_TOKEN_SECRET);
        // console.log(user.user)
        const passuser=user.user
        res.send({message:200,user:passuser})
    }
})

app.post("/register",async function(req,res){
    let {name,email,password}=req.body
    name=_.startCase(name)
    const saltedHash=await bcrypt.hash(password,10);
    const user=new User({
        name,
        _id:email,
        password:saltedHash
    })
    user.save(err=>{
        if(!err)
        res.send(name.split(" ")[0])
    })
    // console.log("success")
    // console.log(req.body.name)
    
});

const getOutput = (outputDetails) => {
    let statusId = outputDetails?.status?.id;
    let ans="";
    if (statusId === 6) {
      // compilation error
      
      ans=(Buffer.from(outputDetails?.compile_output,'base64').toString('binary'));
    } 
    else if (statusId === 3) {
      let temp=Buffer.from(outputDetails.stdout,'base64').toString('binary');
      ans=(temp!==null? temp:"");
    //   setAccpted(true);
    //   setmem(outputDetails?.memory);
    //   setTim(outputDetails?.time);
    } 
    else if (statusId === 5) {
      ans=("Time Limit Exceeded");
    } 
    else {
      ans=(Buffer.from(outputDetails?.stderr,"base64"))
    }
    return ans;
};

app.post("/compile",function(req,res){
    const {custIn, code, nece}=req.body;
    res.send("Succesfully received");
    submissions.findOne({_id:"hehe"},async function(err, submission){
        if(err) console.log(err);
        else
        {
            let cursubId=submission.cnt+1;
            submissions.findOneAndUpdate({_id:"hehe"},{$set:{cnt:cursubId}},function(err1,submission1){
                if(!err1)
                {
                    const newSub= new submissions({
                        code:code,
                        _id:cursubId,
                        custIn: custIn,
                        toDis:getOutput(nece.outputTodis),
                        language:nece.name,
                        byUser: nece.currUser
                    })
                    newSub.save((err2)=>{
                        if(err2) console.log(err2);
                        else
                        {
                            User.findOne({_id:nece.currUser},function(err3,user){
                                if(err3) console.log(err3)
                                else
                                {
                                    let arr=user.submittedCodes;
                                    arr.push(cursubId);
                                    User.findOneAndUpdate({_id:nece.currUser},{$set:{submittedCodes:arr}},function(err4,user){
                                        if(err4) console.log(err4);
                                    })
                                }
                            })
                        }
                    })
                }
            })
        }
    })


})



app.post("/emailverif",function(req,res){
    const {email,vericode}=req.body
    let msg= 'The Verification Code is '+String(vericode)+'\nPlease ignore if you did not request this.'+'\n\nRegards,\nTeam LetsCode';
    // console.log(vericode)
    User.findOne({_id:email},function(err,user){
        if(!err)
        {
            if(user)
            res.send(true)
            else
            {
                res.send(false)
                const message={
                    from: 'letselectronics.ace@outlook.com',
                    to: email,
                    subject: 'Verify your email on LetsCode',
                    text:msg
                }
                transport.sendMail(message,function(err,info){
                    if(err){
                        console.log(err)
                    }
                    else
                        console.log(info)
                })
            }
        }
        else
        res.send(err)
    })

})

app.post("/getSubmissions",function(req,res){
    const{currUser}=req.body;
    var fetchsubId=[];
    User.findOne({_id:currUser},async function(err,user){
        if(err)
        {
            res.send("Error");
        }
        else
        {
            fetchsubId=user.submittedCodes;
            let dataTosend=[];
            for(let idx=0;idx<fetchsubId.length;idx++)
            {
                const query= await submissions.findOne({_id:fetchsubId[idx]});
                dataTosend.push(query);
            }
            // console.log(dataTosend);
            res.send(dataTosend);
        }
    })
})
const PORT = process.env.PORT || 5000;

app.listen(PORT,function(){
    console.log("Sever Started");
    
});