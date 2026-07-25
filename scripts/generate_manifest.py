import json
from pathlib import Path

ROOT=Path("../mains")

def scan(folder):

    data={}

    pdfs=[]

    for item in sorted(folder.iterdir()):

        if item.name.startswith("."):

            continue

        if item.is_dir():

            data[item.name]=scan(item)

        elif item.suffix.lower()==".pdf":

            pdfs.append(item.name)

    if pdfs and not data:

        return pdfs

    if pdfs:

        data["_files"]=pdfs

    return data

manifest={

"mains":scan(ROOT)

}

with open("../manifest.json","w") as f:

    json.dump(manifest,f,indent=4)

print("manifest generated")