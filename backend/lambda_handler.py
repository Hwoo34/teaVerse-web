"""AWS Lambda 엔트리포인트. FastAPI 앱을 Mangum으로 감싸 Function URL 이벤트를 처리한다."""
from mangum import Mangum

from app.local_server import app

handler = Mangum(app, lifespan="off")
