/*Criterion Programming Customer Collection Server*/

//Dependencies

import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import http from 'http'
const bodyparser = import("body-parser")
const mv = import("mv")
const moveFile = import("move-file")
import {Server} from 'socket.io'
const uri = "mongodb://localhost:27017"
import upload  from 'express-fileupload';
import fs from 'fs'

import { MongoClient } from 'mongodb';
 
 // Enable command monitoring for debugging
const mongoClient = new MongoClient('mongodb://localhost:27017', { monitorCommands: true });
mongoClient.connect()


//server calls management

import express from 'express'

const app = express()
app.use(express.json({limit:"1mb"}));
app.use(upload());
app.use(express.static(__dirname));
app.use(express.static(__dirname+'/Images'));
app.use(express.static(__dirname+'/Assets'));

const server = http.createServer(app)

const port = process.env.port || 2255

const io = new Server(server)

//Date and time
let currentDate;
let currentMonth;
let currentMonthString;
let currentYear;
let currentHours;
let currentMins;

async function allocateTime(){
	
	let date = new Date()
	
	let months = ["January", "February", "March", "April" , "May" , "June" , "July" , "August" , "September" , "October" , "November" , "December"]
	
	currentDate = date.getDate();
	currentMonth = date.getMonth();
	currentYear = date.getFullYear();
	currentMonthString = months[currentMonth];
	currentHours = date.getHours();
	currentMins = date.getMinutes();
	
}

allocateTime()

let serverTime = {
	"date":currentDate,
	"month":currentMonth,
	"year":currentYear,
	"hours":currentHours,
	"mins":currentMins
};

async function timeProcessor(){
	
	allocateTime()
	
	serverTime["date"] = currentDate,
	serverTime["month"] = currentMonth,
	serverTime["year"] = currentYear,
	serverTime["hours"] = currentHours,
	serverTime["mins"] = currentMins
	
}

//MAIN PAGE

app.get("/" , async(request,response)=>{
	response.sendFile(__dirname+"/CollectionConsole.html")
})

setInterval(timeProcessor,1400)

/*Socket Helpers*/

async function updateActiveSockets(sockets){
    try{
        await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"user-sockets"},{$set:{"body" : sockets}})
    }catch{
        console.log("An error occurred while processing user sockets")
    }
}

const getActiveUsers = async()=>{
	let get = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"user-sockets"})
	return get.body
}
const activateUserSocket = async(userId)=>{
    let activeUsers = await getActiveUsers()
    let search = activeUsers.find((activeUsers)=>{
        return activeUsers.userId === userId
    })
	if(search){
		search.active = true
	}else{
		setTimeout(()=>{activateUserSocket(userId)},300)
	}

    await updateActiveSockets(activeUsers)
}


const addUserSocket = async(userId)=>{
    let activeUsers = await getActiveUsers()
    let newObj = {
        "userId":userId,
        "active": true,
        "mediaId": null,
        "mediaFormat": null
    }
    
    activeUsers.push(newObj)
    
    await updateActiveSockets(activeUsers)
}

const getUserSocket = async(userId)=>{
    var output = null 
    
    let activeSockets = await getActiveUsers()
    
    let search = activeSockets.find((activeSockets)=>{
        return activeSockets.userId === userId
    })
    if(search){
        output = search
    }
    
    return output
}

const loginSocketFunction = async(userId)=>{
    let activeSockets = await getActiveUsers()
    
    let search = activeSockets.find((activeSockets)=>{
        return activeSockets.userId === userId
    })
    
    
    if(search){
        search.active = true
    }else{
        addUserSocket(userId) 
    }
    
    await updateActiveSockets(activeSockets)
}

const checkIfAdminSocketActive = async(userId)=>{
        
        let output = false
        
        let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"admin-profiles"})
        
        let profiles = getProfiles.body 
        
        let admin = profiles.find((profiles)=>{
            return profiles.id === userId
        })
        
        if(admin){
            let activeSockets = await getActiveUsers()
            let search = activeSockets.find((activeSockets)=>{
                return activeSockets.userId === userId
            })
            
            if(search){
                if(search.active == true){
                    output = true
                }
            }
        }
        
        return output
}

const checkIfSocketActive = async(userId)=>{
    let output = false
    let activeSockets = await getActiveUsers()
    let search = activeSockets.find((activeSockets)=>{
        return activeSockets.userId === userId
    })
    
    
    if(search){
        if(search.active == true){
            output = true
        }
    }
    
    return output
}

async function deactivateUserSocket(userId){
	
	let getUserSockets = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"user-sockets"})
	
	let userSockets = getUserSockets.body
	
	let user = userSockets.find((userSockets)=>{
		
		return userSockets["userId"] === userId
		
	})
	
	if(user){
		
		user["active"] = false
		
	}
	
	await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"user-sockets"},{$set:{"body":userSockets}})
	
}

io.on("connection", async(socket)=>{
	
	socket.on("jobs_updated",()=>{
		socket.emit("update_reviews_and_overviews")
	})
	
	socket.on("disconnect manually" , (data)=>{
		deactivateUserSocket(data.userId)
	})
	
	socket.on("set_media", async(data)=>{
		let userId = data.userId
		let getsockets = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"user-sockets"})
		let sockets = getsockets.body
		let find = sockets.find((sockets)=>{
			return sockets.userId === userId
		})
		if(find){
			find.ownerId = data.ownerId
			find.jobId = data.jobId
		}
		await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"user-sockets"},{$set:{"body":sockets}})
	})
	
	socket.on("set_job_id", async(data)=>{
		let userId = data.userId
		let getsockets = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"user-sockets"})
		let sockets = getsockets.body
		let find = sockets.find((sockets)=>{
			return sockets.userId === userId
		})
		if(find){
			find.jobId = data.jobId
			console.log(find)
		}
		await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"user-sockets"},{$set:{"body":sockets}})
	})
	
	socket.on("user-login",(data)=>{
		let userId = data.userId
		activateUserSocket(userId)
	})
	
	setInterval(async()=>{
		
		let getUserSockets = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"user-sockets"})
		let getUserAdmins = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"admin-profiles"})
		let userSockets = getUserSockets.body
		let admins = getUserAdmins.body
		
		let output = false
		
		for(var x=0; x<admins.length; x++){
			let id = admins[x].id
			let check = await checkIfAdminSocketActive(id)
			if(check == true){
				output = true
				break 
			}
		}
		
		socket.emit("admin-active",{"status":output})
		
	},60000)
	
	setInterval(async()=>{
		
		socket.emit("ping")
		
		let getUserSockets = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"user-sockets"})
		let userSockets = getUserSockets.body
		
		for(var i=0; i<userSockets.length; i++){
			
			userSockets[i].active = false
			
		}
		
		await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"user-sockets"},{$set:{"body":userSockets}})
		
	},70000)
	
	socket.on("affirm",(data)=>{
		activateUserSocket(data.userId)
	});
	
})

function createUserDirectories(userId,jobId,ownerId){
	
	fs.mkdir(path.join(__dirname+"/UserData",`${userId}`),(error)=>{
									if(error){
										if(ownerId){
											fs.mkdir(path.join(__dirname+`/UserData/`,`${ownerId}`),(error)=>{
																		if(error){
																			console.log(error)
																		}else{
																			output = true
																		}
											})
										}
									}
								
	})
	
}

function createBizDirectories(userId,jobId){
	fs.mkdir(path.join(__dirname+`/UserData/${userId}/`,jobId),(error)=>{
																	if(!error){
																		fs.mkdir(__dirname+`/UserData/${userId}/${jobId}/Screenshots/`,(error)=>{
																			if(error){
																				console.log(error)
																			}
																		})
																	}
	})
}

//Code generation
let genCode = (idTemplate)=>{
			let numbers = [0,1,2,3,4,5,6,7,8,9];
	
			let outputArray = []
			
			for(var i=0 ; i<60; i++){
				
				let num = JSON.parse(Math.random().toString()[2])
				
				let check = outputArray.includes(num)
				
				if(num && outputArray.length < 6){
					if(check == false){
					
						outputArray.push(num)
					
					}
				}else if(num && outputArray.length == 5){
					if(check == false){
					
						outputArray.push(num)
						break	
						
					}
				}
				
				
			}
			
			//process num string 
			
			return `${idTemplate}${outputArray[0]}${outputArray[1]}${outputArray[2]}${outputArray[3]}`
		
		} 
		
async function getRates(){

	var output = null

	
	try{
		
		let get = await fetch("https://www.floatrates.com/daily/usd.json")
		
		let response = await get.json()
		
		output = response
		
	}catch{
		
	}
	
	return output
}

function findValue(rates,code){
	var output = null
	
	let keys = rates.keys()
	
	for(var i = 0; i<keys.length; i++){
		var key = keys[i]
		let obj = rates[key]
		if(obj.alphaCode == code){
			output = obj["rate"]
		}
	}
	
	return output
}

app.get("/get-conversion",async(request,response)=>{
	try{
		
		let rates = await getRates()
		
		let data = request.body
		
		let code = data.code
		
		let search = findValue(rates,code)
		
		response.send(JSON.stringify({"value": search}))
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})


//Requests and Responses 

app.get("/check-live-admins", async(request,response)=>{
	try{
		let getUserSockets = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"user-sockets"})
		let getUserAdmins = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"admin-profiles"})
		let userSockets = getUserSockets.body
		let admins = getUserAdmins.body
		
		let output = false
		
		for(var x=0; x<admins.length; x++){
			let id = admins[x].id
			let check = await checkIfAdminSocketActive(id)
			if(check == true){
				output = true
				break 
			}
		}
		response.send(JSON.stringify({"status" : output}))
	}catch{
		response.send(JSON.stringify({"status" : "server-error"}))
	}
})

app.post("/register-job" , async( request,response )=>{ 
    //try{
        
        let data = request.body.newJob
      
        let id = request.body.userId
		
		console.log(data,id)
        
        let check = await checkIfSocketActive(id)
        
        if(check == true) {
        
           let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
        
			let profiles = getProfiles.body 
			
			let user = profiles.find((profiles)=>{
				return profiles.id === id
			})
			
			let i = profiles.findIndex((profiles)=>{
				return profiles.id === id
			})
			
            let jobs = user.jobs 
            
            //Process Id 
            
            let code = genCode("#SDJ-")
            
            data.id = code
            
            profiles[i].jobs.push(data)
			
			createBizDirectories(id,data.id)
            
            await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"client-profiles"},{$set:{"body": profiles}})
            
            response.send(JSON.stringify({"status" : "success" , "jobId":data.id}))
            
        }else{
            response.sendStatus(404)
        }
   /* }catch{
        response.send(JSON.stringify({"status" : "server-error"}))
    }*/
})

app.post("/register-client" , async( request,response )=>{ 
    try{
        
        let data = request.body 
        
        let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
        
        let profiles = getProfiles.body 
        
        //Process User ID
        let code = genCode("CM")
        
        data.id = code

        addUserSocket(data.id)
        
        profiles.push(data)
		
		createUserDirectories(data.id,null,null)
        
        await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"client-profiles"},{$set:{"body": profiles}})
		
        response.send(JSON.stringify({"status" : "success","data":data}))
    }catch{
        response.send(JSON.stringify({"status" : "server-error"}))
    }
}) 

app.post("/delete-client" , async( request,response )=>{ 
    try{
        
        let data = request.body 
        
        let userId = data.userId
        
        let check = await checkIfAdminSocketActive(userId)
        
        if(check == true){
            
            let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
            
            let profiles = getProfiles.body 
            
            let index = profiles.findIndex((profiles)=>{
                return profiles.id === userId
            })
            
            profiles.splice(index,1)
            
            await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"client-profiles"},{$set:{"body": profiles}})
            
            
            response.send(JSON.stringify({"status" : "success"}))
            
        }else{
            response.sendStatus(404)
        }
    }catch{
        response.send(JSON.stringify({"status" : "server-error"}))
    }
}) 

app.post("/delete-admin" , async( request,response )=>{ 
    try{
        
        let data = request.body 
        
        let userId = data.userId

                
        let check = await checkIfAdminSocketActive(userId)
        
        if(check == true){
        
            let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"admin-profiles"})
            
            let profiles = getProfiles.body 
            
            let index = profiles.findIndex((profiles)=>{
                return profiles.id === userId
            })
            
            if(profiles.length > 1){
            
                profiles.splice(index,1)
                
                await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"admin-profiles"},{$set:{"body": profiles}})
    
                response.send(JSON.stringify({"status" : "success"}))
            
            }else{
                response.send(JSON.stringify({"status" : "last-admin"}))
            }
        }
    }catch{
        response.send(JSON.stringify({"status" : "server-error"}))
    }
}) 


app.post("/register-admin" , async( request,response )=>{ 
    try{
        
        let data = request.body.data 
        
        let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"admin-profiles"})
        
        let profiles = getProfiles.body 
        
        //Process User ID
        let code = genCode("CMA-")
        
        data.id = code
		
		data.dateCreated = serverTime

        addUserSocket(data.id)
        
        profiles.push(data)
        
        await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"admin-profiles"},{$set:{"body": profiles}})
        
        
        response.send(JSON.stringify({"status" : "success"}))
    }catch{
        response.send(JSON.stringify({"status" : "server-error"}))
    }
})

app.post("/add-user-update",async( request,response )=>{
    try{
        
        let update = request.body.update
        let userId = request.body.userId
        let jobId = request.body.jobId
		let job = request.body.job
		let ownerId = job.ownerId
        
        let check = await checkIfAdminSocketActive(userId)
        
		
        if(check == true) {
            let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
        
            let profiles = getProfiles.body 
            
            let user = profiles.find((profiles)=>{

                return profiles.id === ownerId
            
            })
            
            let jobs = user.jobs
            
            let job = jobs.find((jobs)=>{

                return jobs.id === jobId
            
            })
            
            let updates = job.updates
            
            update.id = genCode("#SDJU")
            
            updates.push(update)
            
            await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"client-profiles"},{$set:{"body": profiles}})
    
            response.send(JSON.stringify({"status" : "success"}))
            
        }else{
            response.sendStatus(404)
        }
        
    }catch{
        response.send(JSON.stringify({"status" : false}))
    }
})

app.post("/send-payment-data",async( request,response )=>{
   // try{
        
        let payment = request.body.payment
        let userId = request.body.userId
        let jobId = request.body.jobId
        
        let check = await checkIfSocketActive(userId)
        
        if(check == true) {
            let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
        
            let profiles = getProfiles.body 
            
            let user = profiles.find((profiles)=>{

                return profiles.id === userId
            
            })
            
            let jobs = user.jobs
            
            let job = jobs.find((jobs)=>{

                return jobs.id === jobId
            
            })
			
			job.status = "In Progress"
            
            let payments = job.payments
            
            payment.id = genCode(`#${jobId}-`)
            
            payments.push(payment)
			if(payment.firstInstallment == true){
				job.installmentPaid = true
				job.status = "In Progress"
			}else{
				let track = 0
				for(var i=0; i <payments.length; i++){
					let payment = payments[i]
					let value = payment.value
					track = value + track
				}
				if(track < (job.value * 0.99)){
					job.status = "In Progress"
				}else{
					job.status = "Payment Complete"
				}
			}
            
            await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"client-profiles"},{$set:{"body": profiles}})
    
            response.send(JSON.stringify({"status" : true,"data":job}))
            
        }else{
            response.sendStatus(404)
        }
        
   /* }catch{
        response.send(JSON.stringify({"status" : false}))
    }*/
})

app.post("/get-fresh-user-data",async(request,response)=>{
	//try{
		
		let data = request.body
		let userId = data.userId;
		let ownerId = data.ownerId
		
		let check = await checkIfAdminSocketActive(userId)
		let check2 = await checkIfSocketActive(userId)
		console.log(check,check2)
		if(check == true || check2 == true){
			
			let getUsers = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
			
			let users = getUsers.body;
			
			let user = users.find((users)=>{
				return users.id === ownerId
			})
			
			if(user){
				
				response.send(JSON.stringify({"status":"success", "data": user}))
			
			}else{
				
				response.send(JSON.stringify({"status":"server-error"}))			
				
			}
		
		}else{
			response.sendStatus(404)
		}
		
		
	/*}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}*/
})

const processUsersForJobs = (users)=>{
	let output = []
		
		for(var i=0; i<users.length; i++){
			let user = users[i]
			let jobs = user.jobs;
			for(var x=0; x<jobs.length; x++){
				let job = jobs[x]
				let payments = job.payments 
				if(payments.length > 0){
					output.push(job)
				}
			}
		}
		
	return output
}

app.post("/get-paid-jobs", async(request,response)=>{
	//try{
		
		let getUsers = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
			
		let users = getUsers.body; 
		
		let output = await processUsersForJobs(users)
		
		console.log(output)
		
		response.send(JSON.stringify({"status":"success","data":output}))
		
	/*}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}*/
})

app.post("/update-job",async( request,response )=>{
    try{
        
		let data = request.body
        let job = data.update
        let userId = data.userId
        let jobId = data.jobId
		console.log(data,job,userId,jobId)
        
        let check = await checkIfSocketActive(userId)
        if(check == true) {
            let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
        
            let profiles = getProfiles.body 
            
            let user = profiles.find((profiles)=>{

                return profiles.id === userId
            
            })
            
            let jobs = user.jobs
            
            let index = jobs.findIndex((jobs)=>{

                return jobs.id === jobId
            
            })
            
            jobs[index] = job
            
            await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"client-profiles"},{$set:{"body": profiles}})
    
            response.send(JSON.stringify({"status" : true,"data":job}))
            
        }else{
            response.sendStatus(404)
        }
        
    }catch{
        response.send(JSON.stringify({"status" : false}))
    }
})

app.post("/add-user-feedback",async( request,response )=>{
    //try{
        
        let update = request.body.data
        let userId = request.body.userId
        let jobId = request.body.jobId
        
        let check = await checkIfSocketActive(userId)
        
        if(check == true) {
            let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
        
            let profiles = getProfiles.body 
            
            let user = profiles.find((profiles)=>{

                return profiles.id === userId
            
            })
            
            let jobs = user.jobs
            
            let job = jobs.find((jobs)=>{

                return jobs.id === jobId
            
            })
			
			let feedbacks = job.feedback
            
            
            update.id = genCode("#SDJF")
            
            feedbacks.push(update)
            
            await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"client-profiles"},{$set:{"body": profiles}})
    
            response.send(JSON.stringify({"status" : true}))
            
        }else{
            response.sendStatus(404)
        }
        
    /*}catch{
        response.send(JSON.stringify({"status" : "server-error"}))
    }*/
})



app.post("/login-client", async(request,response)=>{
    try{
        
        let userId = request.body.userId
        let password = request.body.password
        
        let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
        
        let profiles = getProfiles.body 
            
        let user1 = profiles.find((profiles)=>{

            return profiles.id === userId
            
        })
        
        let user2 = profiles.find((profiles)=>{

            return profiles.emailAddress === userId
            
        })
        
        if(user1 || user2){
            
            if(user1) {
            
                if(user1.password === password){
                    activateUserSocket(user1.id)
                    response.send(JSON.stringify({"status" : "success" , "data" : user1, "type":"user"}))
                }else{
                    response.send(JSON.stringify({"status" : "wrong-password"}))
                }
                
            }else{
                
                if(user2.password === password){
                    activateUserSocket(user2.id)
                    response.send(JSON.stringify({"status" : "success","data":user2, "type":"user"}))
                }else{
                    response.send(JSON.stringify({"status" : "wrong-password"}))
                }
                
            }
            
        }else{
            
            response.send(JSON.stringify({"status" : "non-existent"}))
        
        }
        
        
    }catch{
        response.send(JSON.stringify({"status" : "server-error"}))
    }
})

app.post("/login-admin", async(request,response)=>{
    try{
        
        let userId = request.body.userId
        let password = request.body.password
        
        let getProfiles = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"admin-profiles"})
        
        let profiles = getProfiles.body 
            
        let user1 = profiles.find((profiles)=>{

            return profiles.id === userId
            
        })
        
        let user2 = profiles.find((profiles)=>{

            return profiles.emailAddress === userId
            
        })
		
        
        if(user1 || user2){
            
            if(user1) {
            
                if(user1.password === password){
                    activateUserSocket(user1.id)
                    response.send(JSON.stringify({"status" : "success","data":user1,"type":"admin"}))
                }else{
                    response.send(JSON.stringify({"status" : "wrong-password"}))
                }
                
            }else{
                
                if(user2.password === password){
                    activateUserSocket(user2.id)
                    response.send(JSON.stringify({"status" : "success","data":user2,"type":"admin"}))
                }else{
                    response.send(JSON.stringify({"status" : "wrong-password"}))
                }
                
            }
            
        }else{
            
            response.send(JSON.stringify({"status" : "non-existent"}))
        
        }
        
        
    }catch{
        response.send(JSON.stringify({"status" : "server-error"}))
    }
})

app.post("/change-user-password-by-email", async(request,response)=>{
	
		
		let data = request.body;
		
		let email = data.email;
		let password = data.password
		console.log(email)
			
			//change user data
			
			let getUsers = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"});
			let getUsers2 = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"admin-profiles"});
			
			let users = getUsers.body;
			let users2 = getUsers2.body;
			
			//locate user Account
			
			let searchUsers = users.find((users)=>{
				return users["emailAddress"] === email
			});
			let searchUsers2 = users2.find((users2)=>{
				return users2["emailAddress"] === email
			});
			
			if(searchUsers){
					//change user password
					searchUsers.password = password
					
					let index = users.findIndex((users)=>{
						return users["emailAddress"] === email
					})
					
					users[index].password = password
					
					
					//update data base
					await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"client-profiles"},{$set:{"body":users}})

					//send response back to User
					response.send(JSON.stringify({"status":true , "data": searchUsers}))
			}
			if(searchUsers2){
					//change user password
					searchUsers2.password = password
					let index = users2.findIndex((users2)=>{
						return users2["emailAddress"] === email
					})
					users2[index].password = password
					
					
					//update data base
					await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"admin-profiles"},{$set:{"body":users2}})

					//send response back to User
					response.send(JSON.stringify({"status":true , "data": searchUsers2}))
			}
			if(!searchUsers && !searchUsers2){
				
				//send response back to User
				response.send(JSON.stringify({"status":false}))
				
			}
			
		
		
	
	
})

app.post("/get-user-sq" , async(request,response)=>{
	
	let data = request.body;
	
	let email = data.email
	
	let responseBody;
	
	try{
		
		//connect to mongo data base
		
		let getUsers = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"});
		let getUsers2 = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"admin-profiles"});
		
		let users = getUsers.body;
		let users2 = getUsers2.body;
		
		//search for user 
		
		let search = users.find((users)=>{
			return users["emailAddress"] === email
		});
		let search2 = users2.find((users2)=>{
			return users2["emailAddress"] === email
		});
		
		
		if(search){
				responseBody = {
					"status":true,
					"q":search.secretQuestion,
					"a":search.secretQuestionAnswer
				}
		}
		if(search2){
				
				console.log("x->"+search2)
				responseBody = {
					"status":true,
					"q":search2.secretQuestion,
					"a":search2.secretQuestionAnswer
				}
		}
		if(!search && !search2){
			responseBody = {
				"status":false,
				"q":null,
				"a":null
			}
		};
			response.send(JSON.stringify(responseBody))
		
	}catch{
		response.sendStatus(404)
	}
	
});


app.post("/change-user-password", async(request,response)=>{
	
	try{
		
		let data = request.body;
		
		let userId = data.userId;
		let password = data.password
		
		//check if user connected
		
		let checkSocket = await checkIfSocketActive(userId,false)
		
		
		if(checkSocket == true){
			
			//change user data
			
			let getUsers = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"});
			
			let users = getUsers.body;
			
			//locate user Account
			
			let searchUsers = users.find((users)=>{
				return users["id"] === userId
			})
			
			if(searchUsers){
				//change user password
				searchUsers.password = password
				
				users[users.findIndex((users)=>{
				return users["id"] === userId
				})].password = password
				
				console.log(users[users.findIndex((users)=>{
				return users["id"] === userId
				})])
				
				//update data base
				await mongoClient.db("CriterionProgrammingData").collection("MainData").updateOne({"name":"client-profiles"},{$set:{"body":users}})

				//send response back to User
				response.send(JSON.stringify({"status":true}))

				console.log("done")
			}else{
				
				//send response back to User
				response.send(JSON.stringify({"status":false}))
				
			}
			
		}
		
		
	}catch{
		response.sendStatus(404)
	}
	
})

app.post("/upload-screenshot/:id", async(request,response)=>{
	try{
		
		let userId = request.params.id 
		
		let check = await checkIfSocketActive(userId)
		
		if(check== true){
			
			let socket = await getUserSocket(userId)
			
			console.log(socket)
			
			let project = socket.jobId
			
			let data = request.files.file
			
			let name = data.name
		
			data.mv(__dirname+`/UserData/${userId}/${project}/Screenshots/`+name,(error)=>{
				if(error){
					console.log(error)
				}
			})
			
			response.send(JSON.stringify({"status":true}))
		}else{
			response.sendStatus(404)
		}
		
	}catch{
		response.send(JSON.stringify({"status":false}))
	}
})

app.post("/upload-zip/:id", async(request,response)=>{
	//try{
		
		let userId = request.params.id 
		let check = await checkIfAdminSocketActive(userId)
		if(check == true){
			
			let socket = await getUserSocket(userId)
			
			let ownerId = socket.ownerId
			
			let jobId = socket.jobId
			
			let mediaName = genCode(`#${jobId}-${ownerId}`)+".zip"
			
			let data = request.files.file
		
			data.mv(__dirname+`/UserData/${ownerId}/${jobId}/${mediaName}.zip`)
				
			response.send(JSON.stringify({"status":true}))
		}else{
			
			response.sendStatus(404)
			
		}
		
		
		
	/*}catch{
		response.send(JSON.stringify({"status":false}))
	}*/
})

app.post('/check-email' , async(request,response)=>{
	
	try{
		
		let email = request.body.email
		
		let usersGet = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
		
		let users = usersGet.body;
		
		let user = users.find((users)=>{
			return users.emailAddress.toLowerCase() === email.toLowerCase()
		})
		
		if(user){
			response.send(JSON.stringify({"status":true}))
		}else{
			response.send(JSON.stringify({"status":false}))
		}
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
	
})

const generateAccessToken = async () =>

{
	const base = "https://api-m.sandbox.paypal.com";
  const client_id = "AbBAhN4KA_82j0QSx3LOVPurpHGt40wsLtBUSBjfwIxxIbUDQW0_j5IrWfQ5scN8YihBWj40LbiZcCV4"
  const client_secret = "EG2IO4QwAMcPQ2zN8GMNZhTmQILyiTeobNwCWpItLohVfmnClG86L_xR_FqU2i9nr3gSdV93RmAYsEDR"
		
  try

  {

    if (!client_id || !client_secret)

    {

      throw new Error("MISSING_API_CREDENTIALS");

    }

    const auth = Buffer.from(

      client_id + ":" + client_secret,

    ).toString("base64");

    const response = await fetch(`${base}/v1/oauth2/token`,

    {

      method: "POST",

      body: "grant_type=client_credentials",

      headers:

      {

        Authorization: `Basic ${auth}`,

      },

    });


    const data = await response.json();

    return data.access_token;

  }

  catch (error)

  {

    console.error("Failed to generate Access Token:", error);

  }

};


async function createPaypalOrder(job,valuex) {

  const accessToken = await generateAccessToken();
  
  console.log(accessToken)

  let response =  await fetch ("https://api-m.sandbox.paypal.com/v2/checkout/orders", {

    method: "POST",

    headers: {

      "Content-Type": "application/json",

      "Authorization": `Bearer ${accessToken}`,

    },

    body: JSON.stringify({

      "purchase_units": [

        {

          "amount": {

            "currency_code": "USD",

            "value": `${valuex}.00`

          },
		  
          "reference_id": `${job.id}`

        }

      ],

      "intent": "CAPTURE"
    })

  });

  return response.json()

}



app.post('/create-paypal-order', async(request,response)=>{
	
	try{
		
		let incoming = request.body;
		
		let value = incoming.value
		let job = incoming.job
		
		console.log(job)
		
		let createOrder = await createPaypalOrder(job,value);
		
		console.log(createOrder)
							
		if(createOrder){
			response.send(JSON.stringify(createOrder))
		}
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
	
})

const captureOrder = async (orderID) =>

{

  const accessToken = await generateAccessToken();
  const base = "https://api-m.sandbox.paypal.com";

  const url = `${base}/v2/checkout/orders/${orderID}/capture`;


  const response = await fetch(url,

  {

    method: "POST",

    headers:

    {

      "Content-Type": "application/json",

      Authorization: `Bearer ${accessToken}`,

      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:

      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/

      // "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'

      // "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'

      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'

    },

  });
  
 
  return await response.json();

};


async function handleResponse(response)

{

  try

  {

    const jsonResponse = await response.json();

    return {

      jsonResponse,

      httpStatusCode: response.status,

    };

  }

  catch (err)

  {

    const errorMessage = await response.text();

    throw new Error(errorMessage);

  }

}

app.post("/api/orders/capture", async(request,response)=>{
	
	try

  {

    const orderID  = request.body.orderID;
	
	console.log(orderID)

    const process = await captureOrder(orderID);
	
	console.log(process)

    response.send(JSON.stringify({"status":process.status}));

  }

  catch (error)

  {

    console.error("Failed to create order:", error);

    response.status(500).json(

    {

      error: "Failed to capture order."

    });

  }
	
	
})

app.get("/find-user/:id", async(request,response)=>{
	try{
		console.log("helo")
		let address = request.params.id 
		
		let getUsers = await mongoClient.db("CriterionProgrammingData").collection("MainData").findOne({"name":"client-profiles"})
		let users = getUsers.body 
		
		let user = users.find((users)=>{
			return users.emailAddress === address
		})
		
		
		
		if(user){
			
			response.send(JSON.stringify({"status":false}))
		
		}else{
			
			response.send(JSON.stringify({"status":true}))
			
		}
		
	}catch{
		response.send(JSON.stringify({"status":"server-error"}))
	}
})


server.listen(port)
