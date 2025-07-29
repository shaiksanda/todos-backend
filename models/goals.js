const mongoose = require("mongoose");

const goalsSchema=new mongoose.Schema({
    title:{
        type:String,
        required:true,
        trim:true
    },
    type:{
        type:String,
        enum:["monthly","quarterly","yearly"],
        required:true
    },
    timeframe:{
        month:{
            type:Number,
            min:1,
            max:12,
            required:function(){
                return this.type==="monthly"
            }
        },
        quarter:{
            type:Number,
            min:1,
            max:4,
            required:function (){
                return this.type==="quarterly"
            }
        },
        year:{
            type:Number,
            required:true
        }
    },
    isCompleted:{
        type:Boolean,
        default:false
    },
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    }
},{
    timestamps:true
})

module.exports =mongoose.model("Goal",goalsSchema)