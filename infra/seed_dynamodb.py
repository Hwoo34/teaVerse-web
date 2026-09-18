"""data/*.json 시드를 DynamoDB tea_content 테이블에 적재.

백엔드 datastore와 동일한 카테고리 키(tea-knowledge/exhibitions/products/artists)를
category 속성으로 사용한다.
"""
import json
import os
import boto3

REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
TABLE = os.environ.get("TEA_DDB_TABLE", "tea_content")
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

CATEGORIES = {
    "tea-knowledge": "tea.json",
    "exhibitions": "exhibitions.json",
    "products": "products.json",
    "artists": "artists.json",
}


def _clean(obj):
    """DynamoDB는 빈 문자열 허용하나 float은 Decimal 필요 → float를 문자열/int로 정리하지 않고
    JSON을 통해 Decimal로 변환."""
    from decimal import Decimal
    return json.loads(json.dumps(obj), parse_float=Decimal)


def main():
    ddb = boto3.resource("dynamodb", region_name=REGION)
    table = ddb.Table(TABLE)
    total = 0
    for cat, fname in CATEGORIES.items():
        with open(os.path.join(DATA_DIR, fname), encoding="utf-8") as f:
            items = json.load(f)
        with table.batch_writer() as bw:
            for it in items:
                row = _clean(it)
                row["category"] = cat
                bw.put_item(Item=row)
                total += 1
        print(f"  {cat}: {len(items)}건")
    print(f"총 {total}건 적재 완료")


if __name__ == "__main__":
    main()
