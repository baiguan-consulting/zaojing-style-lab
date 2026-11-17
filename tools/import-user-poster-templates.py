from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
UPLOADS = ROOT / "public" / "uploads"
TEMPLATES_FILE = ROOT / "data" / "templates.json"
TEMP = Path("C:/Users/12359/AppData/Local/Temp")


TEMPLATE_SOURCES = {
    "travel-art-poster": [
        "codex-clipboard-8856bb1b-f5f6-453d-93cd-909da0b1af18.png",
        "codex-clipboard-c4d02da2-2432-4c8b-a1a7-0761c9e8bd75.png",
        "codex-clipboard-18b755f2-0568-46e7-b0b8-0d73cfe8e21e.png",
    ],
    "glass-art-diptych": [
        "codex-clipboard-b594d78d-540a-414b-afda-5e17db6d0fb9.png",
        "codex-clipboard-e0c75642-e3de-4e62-be1e-b92e1b27fc9e.png",
        "codex-clipboard-f683d1be-bac4-44a6-8c5e-57064bcbe620.png",
    ],
    "low-poly-origami-pet": [
        "codex-clipboard-3c418862-0762-4c02-a355-666ffcd1a02b.png",
        "codex-clipboard-30de42eb-cad7-4a22-8609-468faf56ff27.png",
        "codex-clipboard-789662ed-d3b9-429c-8d7e-4c5f1341e893.png",
    ],
}


def save_jpeg(image: Image.Image, destination: Path) -> None:
    image.convert("RGB").save(destination, "JPEG", quality=92, optimize=True)


def build_comparison_cover(source: Image.Image) -> Image.Image:
    # Remove the carousel chrome by omitting the narrow strip that contains it.
    # Both remaining panels retain their original aspect and form a clean 3:4 poster.
    source = source.convert("RGB")
    image = Image.new("RGB", (1032, 1376))
    image.paste(source.crop((0, 70, 1032, 750)), (0, 0))
    image.paste(source.crop((0, 820, 1032, 1516)), (0, 680))
    return image.resize((1536, 2048), Image.Resampling.LANCZOS)


def extract_styled_output(source: Image.Image) -> Image.Image:
    # The lower panel is the generated style result. Keep it separate so the
    # detail page never presents the comparison poster as a generated output.
    return source.convert("RGB").crop((0, 820, 1032, 1516))


def extract_input(source: Image.Image) -> Image.Image:
    # The supplied reference is a vertical result poster. Its upper panel is
    # the unstyled source image; this crop removes the carousel index badge.
    image = source.convert("RGB").crop((74, 70, 1094, 750))
    return image.resize((2304, 1536), Image.Resampling.LANCZOS)


def build_assets(slug: str, source_names: list[str]) -> list[dict[str, str]]:
    examples = []
    for index, source_name in enumerate(source_names, start=1):
        source = Image.open(TEMP / source_name)
        before_name = f"{slug}-before-{index}.jpg"
        after_name = f"{slug}-after-{index}.jpg"
        comparison_name = f"{slug}-comparison-{index}.jpg"
        save_jpeg(extract_input(source), UPLOADS / before_name)
        save_jpeg(extract_styled_output(source), UPLOADS / after_name)
        save_jpeg(build_comparison_cover(source), UPLOADS / comparison_name)
        examples.append(
            {
                "id": str(uuid4()),
                "inputImage": f"/uploads/{before_name}",
                "outputImage": f"/uploads/{after_name}",
            }
        )
    return examples


def template(
    slug: str,
    name: str,
    tagline: str,
    description: str,
    category: str,
    tags: list[str],
    text_placeholder: str,
    private_prompt: str,
    negative_prompt: str,
) -> dict:
    examples = build_assets(slug, TEMPLATE_SOURCES[slug])
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "id": str(uuid4()),
        "slug": slug,
        "name": name,
        "tagline": tagline,
        "description": description,
        "category": category,
        "tags": tags,
        "coverImage": f"/uploads/{slug}-comparison-1.jpg",
        "examples": examples,
        "allowText": True,
        "allowImage": True,
        "textPlaceholder": text_placeholder,
        "outputRatio": "3:4",
        "outputSize": "1536 × 2048",
        "allowedCounts": [1, 2],
        "priceCredits": 1,
        "providerId": "boxai",
        "model": "gpt-image-2.5-flare",
        "privatePrompt": private_prompt,
        "negativePrompt": negative_prompt,
        "status": "published",
        "isFeatured": False,
        "createdAt": now,
        "updatedAt": now,
    }


def main() -> None:
    UPLOADS.mkdir(parents=True, exist_ok=True)
    templates = json.loads(TEMPLATES_FILE.read_text(encoding="utf-8"))
    slugs = set(TEMPLATE_SOURCES)
    templates = [item for item in templates if item.get("slug") not in slugs]

    new_templates = [
        template(
            "travel-art-poster",
            "轻盈旅行艺术海报",
            "把旅行地标化成明亮通透的极简艺术插画",
            "从旅行照片中提取地标、空间层次和记忆色彩，重新创作为带有柔和渐变、流动曲线与杂志留白的独立艺术海报。",
            "旅行艺术",
            ["旅行", "艺术海报", "极简插画", "明亮渐变"],
            "描述想保留的地标、光线或旅行氛围",
            "基于用户上传的照片，创作一张单张独立的 3:4 竖版高级旅行艺术海报。最终画面只呈现风格化后的艺术作品，不展示原始照片，不制作原图与效果图对照，不进行上下或左右分屏。准确保留照片中最具辨识度的地标、建筑、地形、主体轮廓、空间关系、视角和主要色彩，将整个场景统一重绘为高级极简主义旅行插画。使用天空蓝、淡紫、香槟金、珊瑚粉和暖橙等明亮通透的配色，结合柔和渐变、几何化造型、流动曲线、半透明叠色、精致轮廓线和克制的水面或地面倒影。画面应干净、轻盈、优雅，具有国际旅行艺术海报和品牌视觉设计质感，并保留舒展的编辑式留白。可加入少量清晰易读的英文艺术标题、简短中文意境文案和极少量英文辅助小字；若无法保证文字准确清晰，则完全省略文字。用户补充内容只用于说明希望保留的主体、场景或氛围。",
            "原始照片与风格图同时出现，上下分屏，左右分屏，双联画，前后对比，Before After，拼接图，九宫格，边框，水印，品牌标志，账号名称，乱码，错误文字，模糊文字，低清晰度，重复主体，两个不同地点或不同视角，脏乱画面，过度饱和，比例错误",
        ),
        template(
            "glass-art-diptych",
            "通透玻璃艺术海报",
            "将熟悉的主体凝成通透、柔光的玻璃艺术",
            "提取照片中最有辨识度的主体、动作与色彩，将整幅画面重塑为晶莹透光、留白克制的玻璃艺术杂志海报。",
            "艺术海报",
            ["玻璃艺术", "杂志", "透明雕塑", "柔光"],
            "描述想保留的主体、动作、场景或色彩",
            "基于用户上传的照片，创作一张单张独立的 3:4 竖版高级玻璃艺术杂志海报。最终画面只呈现玻璃艺术化后的完整作品，不保留原始摄影区域，不制作原图与效果图对照，不进行上下或左右分屏。准确继承照片中的主体数量、身份特征、轮廓、姿态、视角、构图关系和主要色彩，把主体完整重塑为精致的透明玻璃艺术雕塑，而不是简单覆盖玻璃滤镜。使用晶莹剔透的玻璃材质、柔和折射、自然透光、精细高光、内部色彩流动和优雅曲线，主体必须清晰可辨并与环境自然融合。背景使用温暖奶油白的细腻纸张或柔光空间，保留大量编辑式留白；从原图提取 2 至 3 种主要色彩，适度提高亮度和纯净度，保持清爽、明亮、通透且协调。可加入简短、清晰易读的英文衬线艺术标题和极少量英文辅助文字，采用高级独立艺术杂志的非对称排版；若文字无法保证准确清晰，则完全省略文字。用户补充内容只用于说明主体、动作、场景或色彩偏好。",
            "原始照片与风格图同时出现，上下分屏，左右分屏，双联画，前后对比，Before After，拼接图，九宫格，塑料感，金属感，镜面过度反光，廉价 3D 渲染，贴纸效果，简单滤镜，磨砂不透明玻璃，水印，品牌标志，账号名称，乱码，错误文字，边框，低清晰度，主体变形，主体数量错误",
        ),
        template(
            "low-poly-origami-pet",
            "低多边形折纸萌宠",
            "把宠物神态折成有动势的低多边形纸艺角色",
            "保留宠物最有辨识度的花色、神态与动作，把整个主体转化为折面清晰、纸张质感真实的独立纸艺角色海报。",
            "宠物创作",
            ["宠物", "折纸", "低多边形", "纸艺角色"],
            "可选：描述动作，或输入不超过 8 个字的短句，例如“今天蹦一下”",
            "基于用户上传的宠物或动物照片，创作一张单张独立的 3:4 竖版低多边形折纸艺术海报。最终画面只呈现折纸艺术化后的角色，不展示原始照片，不制作原图与效果图对照，不进行上下或左右分屏。准确保留动物的种类、数量、主要花色、身份特征、朝向、姿态和神态，将整个主体重新塑造成有动势的低多边形立体折纸角色，而不是玻璃、黏土或塑料玩具。使用大而清楚的硬质折面塑造形体，呈现真实哑光纸张微纹、可见折痕、合理结构和自然投影，角色落脚稳定、轮廓清晰。背景使用浅米色或柔雾色的干净留白，配色从原图提取，并仅少量加入暖冷对比色；可加入两笔轻量动作线和一个小色点，保持版面克制。若用户明确提供一条不超过 8 个简体中文字的短句，可在安全边距内准确排版一次；用户未提供短句时不添加任何文字。",
            "原始照片与风格图同时出现，上下分屏，左右分屏，双联画，前后对比，Before After，拼接图，九宫格，玻璃，透明材质，黏土，塑料玩具，金属，折纸教程，已知卡通角色，额外文字，重复文字，乱码，错误文字，编号，水印，账号，标志，署名，日期，相框，低清晰度，软塌折面，结构不合理，主体数量错误",
        ),
    ]
    TEMPLATES_FILE.write_text(
        json.dumps(new_templates + templates, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
