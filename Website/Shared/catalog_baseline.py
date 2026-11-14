"""Versioned seed/reset inputs. Live product reads never use this manifest."""
import json
from pathlib import Path

BASELINE = json.loads(Path(__file__).with_name('catalog-baseline-v1.json').read_text(encoding='utf-8'))


def source_products():
    return [{**row, 'description': BASELINE['description']} for row in BASELINE['products']]
