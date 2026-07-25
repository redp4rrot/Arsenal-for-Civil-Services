let manifest;
let current=[];

fetch("manifest.json")
.then(r=>r.json())
.then(data=>{

manifest=data;

render([]);

});

function getNode(path){

let node=manifest;

for(const p of path)

node=node[p];

return node;

}

function render(path){

current=path;

const node=getNode(path);

const content=document.getElementById("content");

content.innerHTML="";

document.getElementById("breadcrumbs").innerHTML=
"🏠 Home"
+path.map(p=>" / "+p).join("");

Object.keys(node).sort().forEach(name=>{

const value=node[name];

const card=document.createElement("div");

card.className="card";

if(Array.isArray(value)){

card.innerHTML=`
<div class="icon">📁</div>
<div class="name">${name}</div>
`;

card.onclick=()=>render([...path,name]);

}

else if(typeof value==="object"){

card.innerHTML=`
<div class="icon">📁</div>
<div class="name">${name}</div>
`;

card.onclick=()=>render([...path,name]);

}

else{

card.innerHTML=`
<div class="icon">📄</div>
<div class="name">${name}</div>
`;

}

content.appendChild(card);

});

if(Array.isArray(node)){

content.innerHTML="";

node.forEach(file=>{

const div=document.createElement("div");

div.className="card";

div.innerHTML=`
<div class="icon">📄</div>
<div class="name">${file}</div>
`;

const url=
current.join("/")
+"/"+encodeURIComponent(file);

div.onclick=()=>{

window.open(url,"_blank");

};

content.appendChild(div);

});

}

}