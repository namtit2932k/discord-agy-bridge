Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir
cmd = """C:\Program Files\nodejs\node.exe"" """ & scriptDir & "\bot.mjs"" --log"
shell.Run cmd, 0, True
