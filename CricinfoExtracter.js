// The purpose of this project is to extract information of worldcup 2019 from cricinfo and present that in form
// of excel and pdf scorecards.
// the real purpose is to learn how to extract information and get experience with js.

// npm init -y
//npm install minimist
//npm install axios
//npm install jsdom
//npm install excel4node
//npm install pdf-lib

// node CricinfoExtracter.js --excel=Worldcup.csv --dataDir=worldcup --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-schedule-fixtures-and-results 

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel4node = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");


let args = minimist(process.argv);

// 1.download using axios(axios-- url-> html)
// 2.read using jsdom
// 3.make excel using excel4node
// 4.make pdf using pdf-lib

// 1.download using axios(axios-- url-> html)
let responseKaPromise = axios.get(args.source);
responseKaPromise.then(function(response){
    let html = response.data;
    
    // 2.using jsdom(html -> dom)
    let dom =new jsdom.JSDOM(html);
    let document =dom.window.document; // domn-> document
    let matchdivs59 = document.querySelectorAll("div.ds-text-compact-xxs>div");

    let matchdivs=[];
    let count =0;
    for(let i=matchdivs59.length-1;i>=0;i--){
        count++;
        matchdivs.push(matchdivs59[i]);
        if(count==48)break;
    }

    let matches=[];
    for(let i=0; i<matchdivs.length;i++){
     
        let matchdiv=matchdivs[i];
        let match={
            t1: " ",
            t2: " ",
            t1s: " ",
            t2s: " ",
            result : " "
        };
        
        let resultSpan=matchdiv.querySelector("p>span");
        match.result=resultSpan.textContent;

       
        let teams=matchdiv.querySelectorAll("div>p");
        match.t1=teams[0].textContent;
        match.t2=teams[1].textContent;

        let teamscore=matchdiv.querySelectorAll("div>strong");
        if(teamscore.length==2){
            match.t1s=teamscore[0].textContent;
            match.t2s=teamscore[1].textContent;
        }else if(teamscore.length==1){
            match.t1s = teamscore[0].textContent;
        }

        matches.push(match);
  
    }
   // console.log(matches.length);

    let matcheskaJSON=JSON.stringify(matches);  //Converte JSO->JSON
    fs.writeFileSync("matches.json",matcheskaJSON,"utf-8"); 
    
    // part-1 like -
    // [
    //     {
    //         "name": "England",
    //         "matches": [... .. .... ....]
    //     },
    //     {
    //     },
    //     .......
    // ]
    let teams=[];
    for(let i=0;i<matches.length;i++){
        addTeamIfNotPresent(teams,matches[i].t1);
        addTeamIfNotPresent(teams,matches[i].t2);
    }
  
    // part-2 like
    for(let i=0;i<matches.length;i++){
      addMatchToSpecificTeam(teams,matches[i].t1,matches[i].t2,matches[i].t1s,matches[i].t2s,matches[i].result);
      addMatchToSpecificTeam(teams,matches[i].t2,matches[i].t1,matches[i].t2s,matches[i].t1s,matches[i].result);
    }

    let teamskaJSON=JSON.stringify(teams);  //Converte JSO->JSON
    fs.writeFileSync("teams.json",teamskaJSON,"utf-8"); 
  
    // preparing excel
    prepareExcel(teams,args.excel);
    // preparing Folder & pdf
    prepareFoldersAndPdfs(teams,args.dataDir);



}).catch(function(err){
    console.log(err);
})

// part-1 function
function addTeamIfNotPresent(teams,teamName){
    let tind=false;
    for(let i=0;i<teams.length;i++){
        if(teams[i].name==teamName){
            tind=true;
            break;
        }
    }

    if(tind==false){
        teams.push({
            name : teamName,
            matches : []
        })
    }
}

// part-2 function
function addMatchToSpecificTeam(teams,homeTeam,oppTeam,selfScore,oppScore,result){
    let tind=-1;
    for(let i=0;i<teams.length;i++){
        if(teams[i].name==homeTeam){
            tind=i;
            break;
        }
    }
   
    let team=teams[tind];
    team.matches.push(
        {
            vs:oppTeam,
            selfScore:selfScore,
            oppScore:oppScore,
            result : result
        }
    )
}

// fun-preparing excel
function prepareExcel(teams,excelFileName){
    
    let wb=new excel4node.Workbook();
    for(let i=0;i<teams.length;i++){
       let tsheet = wb.addWorksheet(teams[i].name);
       
       tsheet.cell(1,1).string("Vs");
       tsheet.cell(1,2).string("Self Score");
       tsheet.cell(1,3).string("Opp Score");
       tsheet.cell(1,4).string("Result");

       for(let j=0;j<teams[i].matches.length;j++){
         tsheet.cell(2+j,1).string(teams[i].matches[j].vs);
         tsheet.cell(2+j,2).string(teams[i].matches[j].selfScore);
         tsheet.cell(2+j,3).string(teams[i].matches[j].oppScore);
         tsheet.cell(2+j,4).string(teams[i].matches[j].result);
       }
    }
    wb.write(excelFileName);
}

//func- preparing Folder & pdf
function prepareFoldersAndPdfs(teams,dataDir){
   
  //making folder -> worldcup  
  if(fs.existsSync(dataDir)==true){
   // fs.rmdirSync(dataDir,{recursive : true });
    fs.rmSync(dataDir,{recursive:true});
  }
  fs.mkdirSync(dataDir);
  
  for(let i=0;i<teams.length;i++){
    let teamFolderName = path.join(dataDir,teams[i].name);

    // making folder like -> worldcup/India(All....)
        fs.mkdirSync(teamFolderName);
      

    //making pdf like-> worldcup/India/India.pdf(All.....)
    for(let j=0;j<teams[i].matches.length;j++){
        let match = teams[i].matches[j];
        createMatchScorecardPdf(teamFolderName,teams[i].name,match);
    }

  }
}

function createMatchScorecardPdf(teamFolderName,homeTeam,match){
    let matchFileName = path.join(teamFolderName,match.vs);

    let templateFileBytes = fs.readFileSync("Template.pdf");
    let pdfdocKaPromise = pdf.PDFDocument.load(templateFileBytes);
    pdfdocKaPromise.then( function(pdfdoc){
       let page = pdfdoc.getPage(0);
      // page.drawText("Hello World");
      page.drawText(homeTeam,{x:310, y: 703,size:8});
      page.drawText(match.vs,{x:310, y: 688,size:8});
      page.drawText(match.selfScore,{x:310, y: 675,size:8});
      page.drawText(match.oppScore,{x:310, y: 660,size:8});
      page.drawText(match.result,{x:310, y: 647,size:8});
    
       let changedBytesKaPromise = pdfdoc.save();
       
       changedBytesKaPromise.then(function(changedBytes){
        
        if(fs.existsSync(matchFileName+".pdf")==true){
            fs.writeFileSync(matchFileName+"1.pdf",changedBytes);
        }else{
            fs.writeFileSync(matchFileName+".pdf",changedBytes);
        }
       })
    } )
}





