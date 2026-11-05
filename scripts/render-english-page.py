"""Regenerate the English page from the French markup and the English copy."""
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
dictionary = json.loads((ROOT / "locales/en/page.json").read_text())
translatable = {"alt", "title", "placeholder", "aria-label", "aria-description", "aria-valuetext", "data-description", "data-line"}
translatable_meta = {"description", "twitter:title", "twitter:description"}
translatable_properties = {"og:title", "og:description"}

class EnglishPage(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.raw = False
        self.structured = None  # buffered JSON-LD text while inside <script type="application/ld+json">
        self.missing = set()

    def translate_structured(self, value):
        """Translate the human-readable strings of a JSON-LD document; URLs and schema keywords stay as they are."""
        if isinstance(value, dict):
            return {key: (item if key.startswith("@") else self.translate_structured(item)) for key, item in value.items()}
        if isinstance(value, list):
            return [self.translate_structured(item) for item in value]
        if isinstance(value, str) and not value.startswith(("http://", "https://")):
            return self.translate(value)
        return value

    def translate(self, value):
        key = value.strip()
        if not any(char.isalpha() for char in key):
            return value
        if key not in dictionary:
            self.missing.add(key)
            return value
        return value.replace(key, dictionary[key], 1)

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "html":
            attributes["lang"] = "en"
        if tag in ("script", "style"):
            self.raw = True
            if tag == "script" and attributes.get("type") == "application/ld+json":
                self.structured = ""
        switch = "data-lang-switch" in attributes
        for key, value in list(attributes.items()):
            if value is None:
                continue
            if key in translatable or (key == "content" and (attributes.get("name") in translatable_meta or attributes.get("property") in translatable_properties)):
                value = self.translate(value)
            if key == "content" and attributes.get("property") == "og:locale":
                value = "en_GB"
            if key == "content" and attributes.get("property") == "og:url":
                value = value.replace("index.html", "index-en.html")
            if key == "href" and tag == "link" and attributes.get("rel") == "canonical":
                value = value.replace("index.html", "index-en.html")
            if key == "href" and tag == "a":
                if switch:
                    value = value.replace("index-en.html", "index.html")
                elif "index.html" in value:
                    value = value.replace("index.html", "index-en.html")
            if switch and key in ("lang", "hreflang"):
                value = "fr"
            if key == "href" and value == "/manifest.webmanifest":
                value = "/manifest-en.webmanifest"
            if tag == "script" and key == "src":
                if (PUBLIC / "en" / value.split("?")[0]).is_file():
                    value = "en/" + value
            attributes[key] = value
        rendered = [key if value is None else f'{key}="{escape(value, quote=True)}"' for key,value in attributes.items()]
        self.parts.append("<" + " ".join([tag, *rendered]) + ">")

    def handle_endtag(self, tag):
        if tag == "script" and self.structured is not None:
            document = json.loads(self.structured)
            document = self.translate_structured(document)
            if document.get("@type") == "Organization" and "url" in document:
                document["url"] = document["url"].replace("index.html", "index-en.html")
            self.parts.append(json.dumps(document, ensure_ascii=False, separators=(",", ":")))
            self.structured = None
        if tag in ("script", "style"):
            self.raw = False
        self.parts.append(f"</{tag}>")

    def handle_data(self, data):
        if self.structured is not None:
            self.structured += data
            return
        self.parts.append(data if self.raw else escape(self.translate(data), quote=False))

    def handle_decl(self, decl):
        self.parts.append(f"<!{decl}>")

    def handle_comment(self, data):
        self.parts.append(f"<!--{data}-->")

parser = EnglishPage()
parser.feed((PUBLIC / "index.html").read_text())
parser.close()
if parser.missing:
    raise SystemExit("Missing English copy: " + repr(sorted(parser.missing)))
(PUBLIC / "index-en.html").write_text("".join(parser.parts))
