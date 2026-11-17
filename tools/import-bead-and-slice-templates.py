from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
UPLOADS = ROOT / "public" / "uploads"
TEMPLATES_FILE = ROOT / "data" / "templates.json"
TEMP = Path("C:/Users/12359/AppData/Local/Temp")


TEMPLATE_SOURCES = {
    "perler-bead-landmark": [
        ("codex-clipboard-2c042f1b-7cd2-422f-8817-688abfb63a20.png", 718, 721, True),
        ("codex-clipboard-b4c092d0-7874-4526-8e49-fb216c0d069c.png", 701, 704, True),
        ("codex-clipboard-b27c99de-318a-4b80-8ec3-ddf2fb1fb9bd.png", 713, 715, True),
    ],
    "vertical-slice-sculpture": [
        ("codex-clipboard-79348152-8fa4-40e0-9f1b-7b275dada9b6.png", 720, 725, False),
        ("codex-clipboard-37a3b6b5-10b4-43a1-aa76-ebfc2dd95b0e.png", 740, 743, True),
        ("codex-clipboard-8ef7a7cf-f774-4f26-9463-659e0d11336f.png", 678, 679, True),
    ],
}


def rounded_rectangle(mask: np.ndarray, left: int, top: int, right: int, bottom: int) -> None:
    radius = min((bottom - top) // 2, 28)
    cv2.rectangle(mask, (left + radius, top), (right - radius, bottom), 255, -1)
    cv2.rectangle(mask, (left, top + radius), (right, bottom - radius), 255, -1)
    cv2.circle(mask, (left + radius, top + radius), radius, 255, -1)
    cv2.circle(mask, (right - radius, top + radius), radius, 255, -1)
    cv2.circle(mask, (left + radius, bottom - radius), radius, 255, -1)
    cv2.circle(mask, (right - radius, bottom - radius), radius, 255, -1)


def inpaint(image: Image.Image, masks: list[tuple[str, tuple[int, ...]]]) -> Image.Image:
    rgb = np.array(image.convert("RGB"))
    height, width = rgb.shape[:2]
    mask = np.zeros((height, width), dtype=np.uint8)
    for kind, values in masks:
        if kind == "circle":
            x, y, radius = values
            cv2.circle(mask, (x, y), radius, 255, -1)
        elif kind == "rect":
            left, top, right, bottom = values
            cv2.rectangle(mask, (left, top), (right, bottom), 255, -1)
        elif kind == "rounded":
            rounded_rectangle(mask, *values)
        else:
            raise ValueError(f"Unknown mask type: {kind}")

    if not mask.any():
        return image.convert("RGB")

    # Padding lets OpenCV repair carousel badges that touch a screenshot edge.
    padding = 48
    padded = cv2.copyMakeBorder(rgb, padding, padding, padding, padding, cv2.BORDER_REFLECT)
    padded_mask = cv2.copyMakeBorder(
        mask, padding, padding, padding, padding, cv2.BORDER_CONSTANT, value=0
    )
    repaired = cv2.inpaint(padded, padded_mask, 7, cv2.INPAINT_TELEA)
    repaired = repaired[padding : padding + height, padding : padding + width]
    return Image.fromarray(repaired)


def paint_edge_controls_on_plain_background(image: Image.Image, center_y: int) -> Image.Image:
    """Replace edge carousel controls when the artwork background is near-uniform."""
    rgb = np.array(image.convert("RGB"), dtype=np.float32)
    height, width = rgb.shape[:2]
    row_background = np.empty((height, 1, 3), dtype=np.float32)
    fallback = np.median(rgb[0 : min(20, height), width // 3 : width * 2 // 3], axis=(0, 1))
    for y in range(height):
        row = rgb[y, 100 : width - 100]
        pale = row[(row.min(axis=1) > 210) & ((row.max(axis=1) - row.min(axis=1)) < 28)]
        row_background[y, 0] = np.median(pale, axis=0) if len(pale) else fallback

    repaired = rgb.copy()
    for center_x in (48, width - 26):
        mask = np.zeros((height, width), dtype=np.uint8)
        cv2.circle(mask, (center_x, center_y), 44, 255, -1)
        alpha = cv2.GaussianBlur(mask, (0, 0), 7).astype(np.float32)[:, :, None] / 255
        repaired = repaired * (1 - alpha) + row_background * alpha
    return Image.fromarray(np.clip(repaired, 0, 255).astype(np.uint8))


def save_jpeg(image: Image.Image, destination: Path) -> None:
    image.convert("RGB").save(destination, "JPEG", quality=94, optimize=True)


def clean_source(
    source_path: Path,
    top_end: int,
    bottom_start: int,
    has_carousel_ui: bool,
) -> tuple[Image.Image, Image.Image, Image.Image]:
    with Image.open(source_path) as source:
        image = source.convert("RGB")

    before = image.crop((0, 0, image.width, top_end))
    after = image.crop((0, bottom_start, image.width, image.height))

    if has_carousel_ui:
        before = inpaint(
            before,
            [("rounded", (before.width - 100, 8, before.width - 2, 72))],
        )

        arrow_y = 66 if image.width >= 1100 else 50
        if source_path.name == "codex-clipboard-8ef7a7cf-f774-4f26-9463-659e0d11336f.png":
            arrow_y = 112
        after = inpaint(
            after,
            [
                ("circle", (50, arrow_y, 36)),
                ("circle", (after.width - 50, arrow_y, 36)),
            ],
        )
        if image.width >= 1100:
            after = paint_edge_controls_on_plain_background(after, arrow_y)

    # Carousel pagination dots sit against the lower screenshot edge.
    after = after.crop((0, 0, after.width, max(after.height - 18, 1)))

    separator = 8
    comparison = Image.new(
        "RGB",
        (image.width, before.height + separator + after.height),
        "white",
    )
    comparison.paste(before, (0, 0))
    comparison.paste(after, (0, before.height + separator))
    return before, after, comparison


def build_assets(slug: str) -> list[dict[str, str]]:
    examples = []
    for index, (filename, top_end, bottom_start, has_ui) in enumerate(
        TEMPLATE_SOURCES[slug], start=1
    ):
        before, after, comparison = clean_source(
            TEMP / filename, top_end, bottom_start, has_ui
        )
        before_name = f"{slug}-before-{index}.jpg"
        after_name = f"{slug}-after-{index}.jpg"
        comparison_name = f"{slug}-comparison-{index}.jpg"
        save_jpeg(before, UPLOADS / before_name)
        save_jpeg(after, UPLOADS / after_name)
        save_jpeg(comparison, UPLOADS / comparison_name)
        examples.append(
            {
                "id": str(uuid4()),
                "inputImage": f"/uploads/{before_name}",
                "outputImage": f"/uploads/{after_name}",
            }
        )
    return examples


def make_template(
    *,
    slug: str,
    name: str,
    tagline: str,
    description: str,
    category: str,
    tags: list[str],
    placeholder: str,
    prompt: str,
    negative_prompt: str,
) -> dict:
    examples = build_assets(slug)
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
        "textPlaceholder": placeholder,
        "outputRatio": "3:4",
        "outputSize": "1536 × 2048",
        "allowedCounts": [1, 2],
        "priceCredits": 1,
        "providerId": "boxai",
        "model": "gpt-image-2.5-flare",
        "privatePrompt": prompt,
        "negativePrompt": negative_prompt,
        "status": "published",
        "isFeatured": False,
        "createdAt": now,
        "updatedAt": now,
    }


def main() -> None:
    UPLOADS.mkdir(parents=True, exist_ok=True)

    bead = make_template(
        slug="perler-bead-landmark",
        name="世界建筑拼豆模型",
        tagline="把世界地标拼成一颗颗有孔小豆子的治愈模型",
        description="保留著名建筑最有辨识度的轮廓与结构，用清晰可见的圆形热熔拼豆重建为精致、可爱又具有真实手工质感的立体模型。",
        category="建筑艺术",
        tags=["世界建筑", "拼豆", "手工模型", "治愈系"],
        placeholder="输入建筑名称，或说明希望保留的角度、配色与环境元素",
        prompt=(
            "根据用户输入的建筑名称或上传的建筑参考图，创作一张单张独立的 3:4 竖版创意艺术海报。"
            "最终画面只呈现完成后的立体拼豆建筑模型，不展示真实摄影原图，不制作原图与效果图对照，"
            "不进行上下或左右分屏。准确保留建筑最具辨识度的整体轮廓、比例、立面结构、拱门、塔楼、"
            "屋顶和关键装饰，将完整建筑统一重建为由密集圆形热熔拼豆组成的收藏级手工模型。每颗拼豆都要"
            "清楚呈现圆形轮廓、中心圆孔、规则排列、前后层次和细腻颗粒质感，结构稳定并具有真实手工制作的"
            "立体效果，而不是普通像素块、积木或马赛克。背景使用干净的珍珠白或极浅暖灰影棚空间，采用柔和"
            "产品摄影布光、自然细腻投影和充足留白。模型配色提取自建筑本身，并适度简化为温暖、柔和、治愈"
            "的有限色板。可加入少量蓝白拼豆云朵、黄色装饰线条和一个克制的小爱心；不得让装饰遮挡建筑。"
            "在安全边距内可加入建筑常用且拼写准确的英文名称，使用棕色手写字体和简洁黄色下划线；如果无法"
            "确保名称准确清晰，则省略文字。用户补充内容只用于确定建筑、视角、配色或希望保留的细节，不得"
            "改变拼豆材质和独立成图规则。"
        ),
        negative_prompt=(
            "原始照片与风格图同时出现，上下分屏，左右分屏，双联画，前后对比，Before After，拼接图，"
            "合集，九宫格，轮播箭头，页码圆点，截图界面，普通像素块，方形马赛克，乐高积木，实心塑料，"
            "黏土，纸模型，中心孔消失，拼豆轮廓模糊，建筑结构错误，建筑名称拼写错误，乱码，多余文字，"
            "水印，品牌标志，账号名称，低清晰度，过度饱和，杂乱背景"
        ),
    )

    slice_template = make_template(
        slug="vertical-slice-sculpture",
        name="日常薄片切层雕塑",
        tagline="把人物、动物与日常物件切成通透有光的层片雕塑",
        description="从日常照片中提取主体、姿态与关键场景，用密集等距竖直薄片重建为轮廓完整、缝隙通透且富有层次光影的艺术雕塑。",
        category="艺术海报",
        tags=["切层雕塑", "竖直薄片", "日常艺术", "编辑海报"],
        placeholder="描述人物、动物、物件或场景，以及希望保留的姿态和色彩",
        prompt=(
            "根据用户上传的参考图或文字描述，创作一张单张独立的 3:4 竖版薄片切层雕塑艺术海报。最终画面"
            "只呈现风格重构后的雕塑作品，不展示拟真摄影原图，不制作原图与效果图对照，不进行上下或左右"
            "分屏。准确保留主体身份、数量、姿态、朝向、关键结构和最具辨识度的场景关系，将主体及必要的"
            "环境元素完整重建为一座由密集、等距、竖直薄片组成的艺术雕塑。所有薄片统一沿前后方向排列，"
            "通过切面高低与连续轮廓塑造体积，薄片之间留有清晰通透的缝隙；侧光必须形成细腻、规律而有层次"
            "的片状阴影。材质可以是高级哑光纸板、薄木片或柔和半透明树脂，但必须保持竖直切层结构，不能"
            "变成横向叠纸、毛毡层、实心塑料或普通条纹滤镜。雕塑轻盈地落在暖灰或米白色展台上，背景保持"
            "干净克制，原场景颜色整理为低饱和渐变，并保留大面积编辑式留白。人物面部、手指和肢体自然完整，"
            "动物解剖结构准确，物件结构清楚。可根据主体生成一个简短、准确、清晰的英文艺术标题，采用克制"
            "的衬线体或手写体并避开主体；若无法保证文字准确，则完全省略文字。用户补充内容只用于定义主体、"
            "场景、姿态或配色，不得改变竖直薄片雕塑和独立成图规则。"
        ),
        negative_prompt=(
            "原始照片与风格图同时出现，上下分屏，左右分屏，双联画，前后对比，Before After，拼接图，"
            "合集，九宫格，轮播箭头，页码圆点，截图界面，横向叠层纸雕，毛毡，实心塑料，黏土，普通条纹"
            "滤镜，薄片方向混乱，薄片间距不均，缝隙堵塞，主体轮廓破碎，人物手指错误，面部畸形，动物结构"
            "错误，重复肢体，乱码，多余文字，序号，日期，水印，品牌标志，平台名称，低清晰度，杂乱背景"
        ),
    )

    templates = json.loads(TEMPLATES_FILE.read_text(encoding="utf-8"))
    new_slugs = {bead["slug"], slice_template["slug"]}
    templates = [item for item in templates if item.get("slug") not in new_slugs]
    TEMPLATES_FILE.write_text(
        json.dumps([bead, slice_template, *templates], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
