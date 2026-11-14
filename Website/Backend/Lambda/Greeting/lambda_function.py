import json


def lambda_handler(event, context):
    # API Gateway places URL query parameters inside this dictionary.
    query_parameters = event.get("queryStringParameters") or {}
    name = query_parameters.get("name", "visitor")

    if not isinstance(name, str):
        raise ValueError("name must be a string")

    # Normalize the input and construct the result.
    name = name.strip() or "visitor"

    return {
        "message": f"Hello, {name}!",
        "service": "exodus-portfolio",
    }


if __name__ == "__main__":
    # Simulate a caller while running this file locally.
    sample_event = {
        "version": "2.0",
        "queryStringParameters": {"name": " Brian "},
    }
    result = lambda_handler(sample_event, None)

    assert result["message"] == "Hello, Brian!"
    print(json.dumps(result, indent=2))


