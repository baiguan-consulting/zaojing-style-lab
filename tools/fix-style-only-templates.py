from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
TEMPLATES_FILE = ROOT / "data" / "templates.json"
UPLOADS = ROOT / "public" / "uploads"
DEMO = ROOT / "public" / "demo"


TEMPLATE_UPDATES = {
    "travel-art-poster": {
        "name": "轻盈旅行艺术海报",
        "tagline": "把旅行地标化成明亮通透的极简艺术插画",
        "description": "从旅行照片中提取地标、空间层次和记忆色彩，重新创作为带有柔和渐变、流动曲线与杂志留白的独立艺术海报。",
        "tags": ["旅行", "艺术海报", "极简插画", "明亮渐变"],
        "privatePrompt": (
            "基于用户上传的照片，创作一张单张独立的 3:4 竖版高级旅行艺术海报。"
            "最终画面只呈现风格化后的艺术作品，不展示原始照片，不制作原图与效果图对照，不进行上下或左右分屏。"
            "准确保留照片中最具辨识度的地标、建筑、地形、主体轮廓、空间关系、视角和主要色彩，"
            "将整个场景统一重绘为高级极简主义旅行插画。使用天空蓝、淡紫、香槟金、珊瑚粉和暖橙等明亮通透的配色，"
            "结合柔和渐变、几何化造型、流动曲线、半透明叠色、精致轮廓线和克制的水面或地面倒影。"
            "画面应干净、轻盈、优雅，具有国际旅行艺术海报和品牌视觉设计质感，并保留舒展的编辑式留白。"
            "可加入少量清晰易读的英文艺术标题、简短中文意境文案和极少量英文辅助小字；"
            "若无法保证文字准确清晰，则完全省略文字。用户补充内容只用于说明希望保留的主体、场景或氛围。"
        ),
        "negativePrompt": (
            "原始照片与风格图同时出现，上下分屏，左右分屏，双联画，前后对比，Before After，拼接图，九宫格，"
            "边框，水印，品牌标志，账号名称，乱码，错误文字，模糊文字，低清晰度，重复主体，"
            "两个不同地点或不同视角，脏乱画面，过度饱和，比例错误"
        ),
    },
    "glass-art-diptych": {
        "name": "通透玻璃艺术海报",
        "tagline": "将熟悉的主体凝成通透、柔光的玻璃艺术",
        "description": "提取照片中最有辨识度的主体、动作与色彩，将整幅画面重塑为晶莹透光、留白克制的玻璃艺术杂志海报。",
        "tags": ["玻璃艺术", "杂志", "透明雕塑", "柔光"],
        "privatePrompt": (
            "基于用户上传的照片，创作一张单张独立的 3:4 竖版高级玻璃艺术杂志海报。"
            "最终画面只呈现玻璃艺术化后的完整作品，不保留原始摄影区域，不制作原图与效果图对照，"
            "不进行上下或左右分屏。准确继承照片中的主体数量、身份特征、轮廓、姿态、视角、构图关系和主要色彩，"
            "把主体完整重塑为精致的透明玻璃艺术雕塑，而不是简单覆盖玻璃滤镜。"
            "使用晶莹剔透的玻璃材质、柔和折射、自然透光、精细高光、内部色彩流动和优雅曲线，"
            "主体必须清晰可辨并与环境自然融合。背景使用温暖奶油白的细腻纸张或柔光空间，保留大量编辑式留白；"
            "从原图提取 2 至 3 种主要色彩，适度提高亮度和纯净度，保持清爽、明亮、通透且协调。"
            "可加入简短、清晰易读的英文衬线艺术标题和极少量英文辅助文字，采用高级独立艺术杂志的非对称排版；"
            "若文字无法保证准确清晰，则完全省略文字。用户补充内容只用于说明主体、动作、场景或色彩偏好。"
        ),
        "negativePrompt": (
            "原始照片与风格图同时出现，上下分屏，左右分屏，双联画，前后对比，Before After，拼接图，九宫格，"
            "塑料感，金属感，镜面过度反光，廉价 3D 渲染，贴纸效果，简单滤镜，磨砂不透明玻璃，"
            "水印，品牌标志，账号名称，乱码，错误文字，边框，低清晰度，主体变形，主体数量错误"
        ),
    },
    "low-poly-origami-pet": {
        "name": "低多边形折纸萌宠",
        "tagline": "把宠物神态折成有动势的低多边形纸艺角色",
        "description": "保留宠物最有辨识度的花色、神态与动作，把整个主体转化为折面清晰、纸张质感真实的独立纸艺角色海报。",
        "tags": ["宠物", "折纸", "低多边形", "纸艺角色"],
        "privatePrompt": (
            "基于用户上传的宠物或动物照片，创作一张单张独立的 3:4 竖版低多边形折纸艺术海报。"
            "最终画面只呈现折纸艺术化后的角色，不展示原始照片，不制作原图与效果图对照，不进行上下或左右分屏。"
            "准确保留动物的种类、数量、主要花色、身份特征、朝向、姿态和神态，将整个主体重新塑造成有动势的"
            "低多边形立体折纸角色，而不是玻璃、黏土或塑料玩具。使用大而清楚的硬质折面塑造形体，"
            "呈现真实哑光纸张微纹、可见折痕、合理结构和自然投影，角色落脚稳定、轮廓清晰。"
            "背景使用浅米色或柔雾色的干净留白，配色从原图提取，并仅少量加入暖冷对比色；"
            "可加入两笔轻量动作线和一个小色点，保持版面克制。若用户明确提供一条不超过 8 个简体中文字的短句，"
            "可在安全边距内准确排版一次；用户未提供短句时不添加任何文字。"
        ),
        "negativePrompt": (
            "原始照片与风格图同时出现，上下分屏，左右分屏，双联画，前后对比，Before After，拼接图，九宫格，"
            "玻璃，透明材质，黏土，塑料玩具，金属，折纸教程，已知卡通角色，额外文字，重复文字，乱码，"
            "错误文字，编号，水印，账号，标志，署名，日期，相框，低清晰度，软塌折面，结构不合理，主体数量错误"
        ),
    },
}


STAMP_PROMPT = (
    "根据用户上传的照片，创作一张单张独立的高端复古旅行邮票插画。最终图片只呈现完成后的邮票艺术作品，"
    "不展示原始照片，不制作原图与效果图对照，不进行上下或左右分屏。准确保留原始照片中最具辨识度的主体、"
    "场景、构图关系和主要色彩，将整个场景重新设计为收藏级手工旅行邮票，放置在暖象牙白纸张背景上，"
    "四周保留充足留白。使用彩色铅笔、蜡笔笔触、丙烯色块、纸张颗粒和丝网印刷的不完美效果。"
    "整体温暖、怀旧、优雅、克制。用户补充文字仅用于描述主体和场景，不得改变上述风格与构图要求。"
)

STAMP_NEGATIVE_PROMPT = (
    "原始照片与风格图同时出现，上下分屏，左右分屏，双联画，前后对比，Before After，拼接图，九宫格，"
    "现代商业海报，大型标题，品牌标志，水印，光滑矢量图，3D 渲染，过度饱和"
)


def save_jpeg(image: Image.Image, destination: Path) -> None:
    image.convert("RGB").save(destination, "JPEG", quality=94, optimize=True)


def crop_style_panel(composite: Image.Image) -> Image.Image:
    """Extract the lower style panel from the existing two-panel cover."""
    image = composite.convert("RGB")
    # The original import assembled 680px and 696px panels on a 1376px canvas.
    split_y = round(image.height * 680 / 1376)
    return image.crop((0, split_y, image.width, image.height))


def update_uploaded_examples(template: dict) -> None:
    slug = template["slug"]
    for index, example in enumerate(template["examples"], start=1):
        output_path = ROOT / "public" / example["outputImage"].lstrip("/")
        cover_name = f"{slug}-comparison-{index}.jpg"
        cover_path = UPLOADS / cover_name
        if not cover_path.exists():
            shutil.copy2(output_path, cover_path)
        with Image.open(cover_path) as composite:
            save_jpeg(crop_style_panel(composite), output_path)
    template["coverImage"] = f"/uploads/{slug}-comparison-1.jpg"


def cover_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), size, Image.Resampling.LANCZOS)


def build_stamp_comparison() -> str:
    destination = DEMO / "stamp-lake-comparison.webp"
    with Image.open(DEMO / "stamp-lake-input.webp") as source, Image.open(
        DEMO / "stamp-lake-output.webp"
    ) as result:
        width, panel_height = 1536, 1024
        image = Image.new("RGB", (width, panel_height * 2), "#f3ecdc")
        image.paste(cover_crop(source, (width, panel_height)), (0, 0))
        image.paste(cover_crop(result, (width, panel_height)), (0, panel_height))
        image.save(destination, "WEBP", quality=92, method=6)
    return "/demo/stamp-lake-comparison.webp"


def main() -> None:
    templates = json.loads(TEMPLATES_FILE.read_text(encoding="utf-8"))
    by_slug = {template["slug"]: template for template in templates}

    missing = set(TEMPLATE_UPDATES) - set(by_slug)
    if missing:
        raise SystemExit(f"Missing templates: {', '.join(sorted(missing))}")

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    for slug, updates in TEMPLATE_UPDATES.items():
        template = by_slug[slug]
        update_uploaded_examples(template)
        template.update(updates)
        template["updatedAt"] = now

    stamp = by_slug.get("vintage-travel-stamp")
    if not stamp:
        raise SystemExit("Missing vintage-travel-stamp template")
    stamp["coverImage"] = build_stamp_comparison()
    stamp["privatePrompt"] = STAMP_PROMPT
    stamp["negativePrompt"] = STAMP_NEGATIVE_PROMPT
    stamp["updatedAt"] = now

    TEMPLATES_FILE.write_text(
        json.dumps(templates, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
