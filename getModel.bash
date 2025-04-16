curl -X POST http://192.168.0.239:42004/call/generation_all -s -H "Content-Type: application/json" -d '{ 
	"data": [
    "",
    {"path":"http://192.168.0.239:42004/file=C:\\pinokio\\api\\Hunyuan3D-2-lowvram.gitback\\cache\\GRADIO_TEMP_DIR\\2f117737b9ac91c6c7ebe617313079c5e1846b6a47437482937d211dbafed457\\ChatGPT Image Mar 30 2025 05_55_31 PM.png"},
    None,
    None,
    None,
    None,
    30,
    5,
    1234,
    256,
    true,
    8000,
    true
]}' \
  | awk -F'"' '{ print $4}' \
  | read EVENT_ID; curl -N http://192.168.0.239:42004/call/generation_all/$EVENT_ID

curl -X POST http://192.168.0.239:42004/call/lambda_4 -s -H "Content-Type: application/json" -d '{ 
	"data": [
]}' \
  | awk -F'"' '{ print $4}' \
  | read EVENT_ID; curl -N http://192.168.0.239:42004/call/lambda_4/$EVENT_ID

curl -X POST http://192.168.0.239:42004/call/lambda_5 -s -H "Content-Type: application/json" -d '{ 
	"data": [
]}' \
  | awk -F'"' '{ print $4}' \
  | read EVENT_ID; curl -N http://192.168.0.239:42004/call/lambda_5/$EVENT_ID

curl -X POST http://192.168.0.239:42004/call/lambda_6 -s -H "Content-Type: application/json" -d '{ 
	"data": [
]}' \
  | awk -F'"' '{ print $4}' \
  | read EVENT_ID; curl -N http://192.168.0.239:42004/call/lambda_6/$EVENT_ID

curl -X POST http://192.168.0.239:42004/call/on_export_click -s -H "Content-Type: application/json" -d '{ 
	"data": [
    {"path":"http://192.168.0.239:42004/file=C:\\pinokio\\api\\Hunyuan3D-2-lowvram.gitback\\cache\\GRADIO_TEMP_DIR\\d98acd2127cc9524b8992f0fa218be2e8f9780105d94b2a14fd716f553a14680\\white_mesh.glb"},
    {"path":"http://192.168.0.239:42004/file=C:\\pinokio\\api\\Hunyuan3D-2-lowvram.gitback\\cache\\GRADIO_TEMP_DIR\\fb90d002051d163996ae197bb99443a6ef6f92fc0ef9df78c47a1905c0584d56\\textured_mesh.glb"},
    "glb",
    false,
    true,
    10000
]}' \
  | awk -F'"' '{ print $4}' \
  | read EVENT_ID; curl -N http://192.168.0.239:42004/call/on_export_click/$EVENT_ID