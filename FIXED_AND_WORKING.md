===========================================================
PIPELINE: Preprocess + Combine → Domain A 45K
============================================================
CelebA-HQ : /kaggle/input/datasets/nikhil1616/celeba-hq-huggingface/images
UTKFace   : /kaggle/input/datasets/jangedoo/utkface-new/UTKFace
FFHQ      : /kaggle/input/datasets/arnaud58/flickrfaceshq-dataset-ffhq
Target    : 15,000 × 3 = 45,000 images

All 3 input datasets found ✓
Haar cascades loaded ✓


[1/3] CelebA-HQ: 30,000 images at /kaggle/input/datasets/nikhil1616/celeba-hq-huggingface/images

────────────────────────────────────────────────────────────
[celeba_hq]  candidates: 30,000  |  target: 15,000

  Scoring celeba_hq:  20%|██        | 6127/30000 [02:50<07:22, 54.00it/s]
add Codeadd Markdown okay it is working now give me code for # 02_preprocess_and_filter.py

import cv2, json, numpy as np
from pathlib import Path
from PIL import Image, ImageEnhance
from tqdm import tqdm

BASE_DIR  = Path("./data")
RAW_DIR   = BASE_DIR / "raw"
CLEAN_DIR = BASE_DIR / "domain_A_clean"
FINAL_DIR = BASE_DIR / "domain_A_final"
CLEAN_DIR.mkdir(parents=True, exist_ok=True)
FINAL_DIR.mkdir(parents=True, exist_ok=True)

MIN_BLUR_SCORE = 80    # Laplacian variance threshold — below = blurry, reject
MIN_FACE_AREA  = 0.05  # Face must cover ≥5% of image


def blur_score(arr):
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def face_coverage(arr, cascade):
    gray  = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    faces = cascade.detectMultiScale(gray, 1.1, 4, minSize=(40, 40))
    if not len(faces): return 0.0
    return sum(w*h for _,_,w,h in faces) / (arr.shape[0] * arr.shape[1])


def smart_crop_resize(img, size=(512, 512)):
    """Square crop biased 25% toward top — preserves faces in portrait shots."""
    w, h = img.size
    s    = min(w, h)
    left = (w - s) // 2
    top  = int((h - s) * 0.25) if h > w else 0
    return img.crop((left, top, left+s, top+s)).resize(size, Image.LANCZOS)


def apply_augment(img, aug_id):
    """6 deterministic augmentations — no random seed chaos."""
    if aug_id == 0: return img.copy()
    elif aug_id == 1: return img.transpose(Image.FLIP_LEFT_RIGHT)
    elif aug_id == 2: return ImageEnhance.Color(img).enhance(0.85)        # Desaturate
    elif aug_id == 3: return ImageEnhance.Contrast(img).enhance(1.15)     # Contrast+
    elif aug_id == 4: return ImageEnhance.Brightness(img).enhance(1.08)   # Brighter
    elif aug_id == 5:
        # Flip + warm color temperature
        flipped = img.transpose(Image.FLIP_LEFT_RIGHT)
        r, g, b = flipped.split()
        return Image.merge("RGB", (
            ImageEnhance.Brightness(r).enhance(1.08), g,
            ImageEnhance.Brightness(b).enhance(0.92),
        ))
    return img.copy()


def run_pipeline():
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    # (source_dir, require_face, max_count)
    # require_face=False for COCO — full-body/group shots don't need frontal face
    configs = [
        (RAW_DIR / "ffhq",        True,  1500),
        (RAW_DIR / "celeba_hq",   True,   800),
        (RAW_DIR / "utk_face",    True,   600),
        (RAW_DIR / "coco_people", False,  400),
    ]

    total = 0
    stats = {}

    for src_dir, req_face, limit in configs:
        if not src_dir.exists():
            print(f"⚠ Skipping {src_dir.name} — not downloaded yet")
            continue

        name = src_dir.name
        imgs = list(src_dir.glob("**/*.jpg")) + list(src_dir.glob("**/*.png"))
        saved = failed = 0

        print(f"\nFiltering: {name} (limit={limit})")
        for p in tqdm(imgs, desc=name):
            if saved >= limit: break
            try:
                img = Image.open(p).convert("RGB")
                if img.width < 200 or img.height < 200:
                    failed += 1; continue
                arr = np.array(img)
                if blur_score(arr) < MIN_BLUR_SCORE:
                    failed += 1; continue
                if req_face and face_coverage(arr, cascade) < MIN_FACE_AREA:
                    failed += 1; continue

                out = CLEAN_DIR / f"{name}_{total+saved:05d}.jpg"
                smart_crop_resize(img).save(out, "JPEG", quality=95)
                saved += 1
            except Exception:
                failed += 1

        stats[name] = {"saved": saved, "failed": failed}
        total += saved
        print(f"  ✓ {saved} saved, {failed} rejected ({failed/(saved+failed+1)*100:.1f}% rejection rate)")

    # Augmentation — 3x dataset size for free
    print(f"\nAugmenting {total} clean images × 3 variants...")
    aug_total = 0
    for p in tqdm(list(CLEAN_DIR.glob("*.jpg")), desc="Augmenting"):
        img = Image.open(p).convert("RGB")
        for aug_id in range(3):
            apply_augment(img, aug_id).save(
                FINAL_DIR / f"{p.stem}_a{aug_id}.jpg", "JPEG", quality=93
            )
            aug_total += 1

    with open(BASE_DIR / "filter_stats.json", "w") as f:
        json.dump(stats, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Clean images: {total}  |  Augmented: {aug_total}")
    print(f"Output: {FINAL_DIR.absolute()}")
    print(f"Next: Run 03_synthesize_sketches.py") and this # 03_synthesize_sketches.py
# Run on Kaggle GPU notebook — 30 hrs/week FREE
# !pip install diffusers transformers accelerate xformers scikit-image -q

import torch, json, numpy as np
from pathlib import Path
from PIL import Image
from tqdm import tqdm
from skimage.metrics import structural_similarity as ssim

BASE_DIR     = Path("./data")
DOMAIN_A_DIR = BASE_DIR / "domain_A_final"
DOMAIN_B_DIR = BASE_DIR / "domain_B_sketches"
PAIRS_DIR    = BASE_DIR / "paired_dataset"
LOG_FILE     = BASE_DIR / "synthesis_log.json"
DOMAIN_B_DIR.mkdir(parents=True, exist_ok=True)
PAIRS_DIR.mkdir(parents=True, exist_ok=True)


# ════════════════════════════════════════════════════════════
# THE MASTER PROMPT — Every clause is here for a reason.
# Removing any clause degrades a specific aspect of the output.
# ════════════════════════════════════════════════════════════

STYLE_PROMPTS = [
    {
        "name": "warm_pencil",
        "weight": 0.40,  # 40% of dataset — the primary target style
        "positive": (
            # ── Core style identity
            "colored pencil sketch, hand drawn with Prismacolor colored pencils, "
            
            # ── Texture descriptors (what makes it look like PENCIL, not digital)
            "visible pencil stroke marks throughout, directional hatching in shadow areas, "
            "cross-hatching for deep shadows and folds, paper grain texture visible throughout, "
            "waxy pencil sheen on highlight areas, layered color pencil marks, "
            "pigment visible on paper fibers, "
            
            # ── Color palette (muted, warm — pencil colors ≠ photo colors)
            "warm amber and ochre skin tones, muted desaturated color palette, "
            "soft pastel highlights on face, sienna mid-tones in shadows, "
            "warm golden ambient light, cool blue-grey in deepest shadows, "
            
            # ── Quality anchors (tells the model what reference class this belongs to)
            "traditional fine art illustration, professional portrait sketch, "
            "detailed pencil face rendering, realistic anatomy and proportions, "
            "high detail Prismacolor pencil work, studio sketch quality, "
            "toned cream paper background showing through strokes, "
            "hand-crafted traditional media feel"
        ),
        "negative": (
            "photograph, photorealistic, camera image, DSLR photo, stock photo, "
            "digital painting smooth rendering, airbrushed skin, perfect texture, "
            "plastic look, 3d render, CGI, ray traced, "
            "anime style, manga, cartoon, cel shading, comic book art, "
            "flat solid color fill, clean outline only, vector art illustration, "
            "oil painting, watercolor wash, gouache, acrylic, ink wash, "
            "charcoal only drawing, black and white only, monochromatic, "
            "blurry, low quality, bad anatomy, distorted face, extra fingers, "
            "neon colors, oversaturated, garish, fluorescent colors, "
            "sepia photo filter, instagram filter, tinted photo"
        ),
    },
    {
        "name": "cool_graphite_color",
        "weight": 0.30,  # Adds cool-light variety (overcast, indoor, blue hour)
        "positive": (
            "colored pencil drawing with graphite underdrawing, artist sketch, "
            "cool blue-grey shadow tones with warm skin mid-tones, "
            "directional hatching lines in hair and clothing, "
            "visible paper texture and paper white showing through strokes, "
            "fine pencil strokes for hair detail, loose crosshatch shading, "
            "professional colored pencil illustration, sketchbook quality art, "
            "Faber-Castell Polychromos pencil style, high contrast textured rendering, "
            "cool overcast studio lighting, realistic face proportions preserved"
        ),
        "negative": (
            "photograph, photorealistic, digital painting smooth, anime, cartoon, "
            "watercolor, oil paint, ink wash, flat shading, cel shading, "
            "no texture visible, clean digital art, 3d rendered, plastic look, "
            "airbrushed portrait, oversaturated, garish colors"
        ),
    },
    {
        "name": "expressive_loose",
        "weight": 0.30,  # Loose gestural style — adds variety, prevents overfitting
        "positive": (
            "expressive colored pencil portrait, loose gestural pencil strokes, "
            "vibrant but muted pencil colors, visible white paper showing through strokes, "
            "sketchy loose marks defining form and volume, cross-hatched dark areas, "
            "colored pencil on warm toned paper, impressionistic face rendering, "
            "rough textured pencil marks, hand-crafted sketchbook quality, "
            "studio artist sketch, bold confident pencil strokes, "
            "warm ochre toned paper background, layered color pencil technique"
        ),
        "negative": (
            "clean digital, smooth rendering, photograph, anime, cartoon, "
            "perfect lines, vector, no texture, flat color blocks, "
            "overly detailed photo-real, airbrushed portrait, 3d render"
        ),
    },
]

# Generation parameters — calibrated for T4 16GB VRAM
GEN_CONFIG = {
    "strength":       0.62,   # CRITICAL: 0.55–0.68 range. 0.62 = best balance
    "guidance_scale": 8.0,    # 7–9. Higher = more prompt-faithful
    "num_steps":      35,     # 30–45. More = better detail but slower
    "ssim_min":       0.22,   # Reject: structure destroyed (face unrecognizable)
    "ssim_max":       0.72,   # Reject: style didn't apply (still looks like photo)
}


def load_pipeline():
    from diffusers import StableDiffusionImg2ImgPipeline
    
    print("Loading SD 2.1 (~5GB download on first run, cached after)...")
    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        "stabilityai/stable-diffusion-2-1",
        torch_dtype=torch.float16,
        safety_checker=None,
        requires_safety_checker=False,
    ).to("cuda")
    
    pipe.enable_xformers_memory_efficient_attention()
    pipe.enable_attention_slicing(1)
    pipe.enable_vae_slicing()  # Prevents OOM during image decode
    
    print(f"  VRAM used: {torch.cuda.memory_allocated()/1e9:.1f}GB / "
          f"{torch.cuda.get_device_properties(0).total_memory/1e9:.1f}GB")
    return pipe


def pick_style(idx):
    """Deterministic style assignment — reproducible dataset distribution."""
    val = (idx * 7 + 13) % 100 / 100
    cumulative = 0
    for s in STYLE_PROMPTS:
        cumulative += s["weight"]
        if val < cumulative:
            return s
    return STYLE_PROMPTS[0]


def quality_gate(orig_arr, gen_arr):
    """SSIM check: reject if style didn't apply OR structure was destroyed."""
    o = np.mean(orig_arr, axis=2)
    g = np.mean(gen_arr,  axis=2)
    score = ssim(o, g, data_range=255)
    if score >= GEN_CONFIG["ssim_max"]: return False, score, "no_style_applied"
    if score <= GEN_CONFIG["ssim_min"]: return False, score, "structure_destroyed"
    return True, score, "ok"


def synthesize(pipe, max_pairs=3000, resume=True):
    sources = sorted(
        list(DOMAIN_A_DIR.glob("*.jpg")) + list(DOMAIN_A_DIR.glob("*.png"))
    )
    if not sources:
        print(f"ERROR: No images in {DOMAIN_A_DIR} — run 02_preprocess_and_filter.py first")
        return

    log = {}
    if resume and LOG_FILE.exists():
        with open(LOG_FILE) as f: log = json.load(f)
        already_done = sum(1 for v in log.values() if v.get("pass"))
        print(f"  Resuming from checkpoint: {already_done} already generated")

    generated = rejected = 0

    for idx, src in enumerate(tqdm(sources, desc="Synthesizing")):
        if generated >= max_pairs: break
        stem = src.stem
        
        # Resume: skip already-processed
        if resume and stem in log and log[stem].get("pass"):
            generated += 1; continue
        
        try:
            img = Image.open(src).convert("RGB").resize((512, 512), Image.LANCZOS)
            style = pick_style(idx)

            with torch.autocast("cuda"):
                result = pipe(
                    prompt=style["positive"],
                    negative_prompt=style["negative"],
                    image=img,
                    strength=GEN_CONFIG["strength"],
                    guidance_scale=GEN_CONFIG["guidance_scale"],
                    num_inference_steps=GEN_CONFIG["num_steps"],
                    generator=torch.Generator("cuda").manual_seed(idx),
                ).images[0]

            orig_arr = np.array(img.resize((256, 256)))
            gen_arr  = np.array(result.resize((256, 256)))
            ok, score, reason = quality_gate(orig_arr, gen_arr)

            if ok:
                # Save sketch (Domain B)
                result.save(DOMAIN_B_DIR / f"{stem}_sketch.jpg", "JPEG", quality=95)
                
                # Save Pix2Pix pair (A|B stitched side-by-side, 1024×512)
                pair = Image.new("RGB", (1024, 512))
                pair.paste(img, (0, 0))
                pair.paste(result, (512, 0))
                pair.save(PAIRS_DIR / f"pair_{generated:05d}.jpg", "JPEG", quality=93)
                
                log[stem] = {"pass": True, "ssim": round(score, 4), "style": style["name"]}
                generated += 1
            else:
                log[stem] = {"pass": False, "ssim": round(score, 4), "reason": reason}
                rejected += 1

            # Checkpoint every 50 images + clear GPU cache
            if (idx + 1) % 50 == 0:
                with open(LOG_FILE, "w") as f: json.dump(log, f)
                torch.cuda.empty_cache()

        except torch.cuda.OutOfMemoryError:
            torch.cuda.empty_cache()
        except Exception as e:
            print(f"\n  Error {src.name}: {e}")

    with open(LOG_FILE, "w") as f: json.dump(log, f, indent=2)

    pass_rate = generated / max(generated + rejected, 1) * 100
    print(f"\n{'='*60}")
    print(f"Generated: {generated}  |  Rejected: {rejected}  |  Pass rate: {pass_rate:.1f}%")
    print(f"If pass rate < 60%: lower strength to 0.55 or raise ssim_max to 0.75")
    print(f"Pairs saved: {PAIRS_DIR.absolute()}")


if __name__ == "__main__":
    if not torch.cuda.is_available():
        print("No GPU! Use Kaggle: kaggle.com/code → New Notebook → Settings → GPU T4×2")
        exit(1)
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    pipe = load_pipeline()
    synthesize(pipe, max_pairs=3000, resume=True) and this # 04_inference.py
# !pip install diffusers transformers accelerate xformers controlnet-aux -q

import torch
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

# ════════════════════════════════════════════════════
# FINAL INFERENCE PROMPT — Best quality output
# ════════════════════════════════════════════════════

POSITIVE_PROMPT = (
    "colored pencil sketch, hand drawn with Prismacolor colored pencils, "
    "visible pencil stroke marks throughout, directional hatching in shadow areas, "
    "cross-hatching for deep shadows, paper grain texture visible throughout, "
    "waxy pencil sheen on highlights, layered color pencil marks, "
    "warm amber ochre skin tones, muted desaturated color palette, "
    "soft pastel highlights, sienna mid-tone shadows, warm golden ambient light, "
    "cool blue-grey deepest shadows, traditional fine art illustration, "
    "professional portrait sketch, detailed pencil face rendering, "
    "realistic anatomy and proportions preserved, high detail Prismacolor work, "
    "studio sketch quality, cream paper background showing through strokes"
)

NEGATIVE_PROMPT = (
    "photograph, photorealistic, camera image, stock photo, "
    "digital painting smooth rendering, airbrushed skin, plastic look, "
    "3d render, CGI, anime, manga, cartoon, cel shading, flat solid fill, "
    "vector art, oil painting, watercolor, gouache, ink wash, "
    "black and white only, blurry, bad anatomy, distorted face, "
    "neon colors, oversaturated, fluorescent, instagram filter"
)

# Style additions — prepend to POSITIVE_PROMPT
STYLES = {
    "warm_golden":   "warm amber golden hour light, soft warm pencil tones, ",
    "cool_studio":   "cool blue studio lighting, blue-grey pencil shadows, ",
    "vibrant":       "vibrant but muted rich pencil colors, deep color saturation, ",
    "loose_sketchy": "loose expressive gestural pencil strokes, sketchy feel, ",
    "fine_detail":   "extremely fine precise pencil strokes, tight controlled marks, ",
}


class PencilSketchConverter:
    """
    Three quality modes:
      quick   — SD img2img only.            8–12s/image on T4.
      precise — + ControlNet Depth.         15–20s/image. Best for portraits.
      ultra   — + ControlNet Depth + Canny. 20–30s/image. Maximum fidelity.
    """
    
    def __init__(self, mode="precise", lora_path=None):
        self.mode   = mode
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype  = torch.float16 if self.device == "cuda" else torch.float32
        print(f"Loading pipeline (mode={mode})...")
        
        if mode == "quick":
            self._load_quick()
        elif mode in ("precise", "ultra"):
            self._load_controlnet(mode)
        
        if lora_path:
            self.pipe.load_lora_weights(lora_path)
            self.pipe.fuse_lora(lora_scale=0.85)
            print(f"  LoRA loaded: {lora_path}")
    
    def _load_quick(self):
        from diffusers import StableDiffusionImg2ImgPipeline
        self.pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
            "stabilityai/stable-diffusion-2-1",
            torch_dtype=self.dtype, safety_checker=None,
            requires_safety_checker=False,
        ).to(self.device)
        self._optimize()
    
    def _load_controlnet(self, mode):
        from diffusers import StableDiffusionControlNetImg2ImgPipeline, ControlNetModel
        from controlnet_aux import MidasDetector
        
        cnets = [ControlNetModel.from_pretrained(
            "lllyasviel/sd-controlnet-depth", torch_dtype=self.dtype
        )]
        if mode == "ultra":
            from controlnet_aux import CannyDetector
            cnets.append(ControlNetModel.from_pretrained(
                "lllyasviel/sd-controlnet-canny", torch_dtype=self.dtype
            ))
            self.canny = CannyDetector()
        
        self.pipe = StableDiffusionControlNetImg2ImgPipeline.from_pretrained(
            "stabilityai/stable-diffusion-2-1",
            controlnet=cnets if len(cnets) > 1 else cnets[0],
            torch_dtype=self.dtype, safety_checker=None,
            requires_safety_checker=False,
        ).to(self.device)
        
        self.depth = MidasDetector.from_pretrained("lllyasviel/Annotators")
        self._optimize()
    
    def _optimize(self):
        try:    self.pipe.enable_xformers_memory_efficient_attention()
        except: self.pipe.enable_attention_slicing(1)
        self.pipe.enable_vae_slicing()
    
    def _post_process(self, img):
        """Subtle sharpening + desaturation to enhance pencil feel."""
        img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=3))
        img = ImageEnhance.Contrast(img).enhance(1.08)
        img = ImageEnhance.Color(img).enhance(0.88)  # Slight desaturation
        return img
    
    @torch.no_grad()
    def convert(
        self,
        image,
        style="warm_golden",
        strength=0.62,
        guidance_scale=8.0,
        num_steps=40,
        seed=42,
        controlnet_scale=0.80,
    ):
        """
        Args:
            image:            PIL Image or path string
            style:            Key from STYLES dict
            strength:         0.55–0.68. Lower = more original preserved.
            guidance_scale:   7–9. Higher = stronger prompt adherence.
            num_steps:        35–50. More = better but slower.
            seed:             Fixed for reproducibility.
            controlnet_scale: 0.70–0.85. Higher = more structural lock.
        """
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")
        
        img = image.resize((512, 512), Image.LANCZOS)
        gen = torch.Generator(self.device).manual_seed(seed)
        
        pos = STYLES.get(style, "") + POSITIVE_PROMPT
        neg = NEGATIVE_PROMPT
        
        with torch.autocast(self.device):
            if self.mode == "quick":
                out = self.pipe(
                    prompt=pos, negative_prompt=neg,
                    image=img, strength=strength,
                    guidance_scale=guidance_scale,
                    num_inference_steps=num_steps,
                    generator=gen,
                ).images[0]
            
            elif self.mode == "precise":
                depth_map = self.depth(img)
                if not isinstance(depth_map, Image.Image):
                    depth_map = Image.fromarray(depth_map)
                out = self.pipe(
                    prompt=pos, negative_prompt=neg,
                    image=img, control_image=depth_map,
                    strength=strength, guidance_scale=guidance_scale,
                    num_inference_steps=num_steps,
                    controlnet_conditioning_scale=controlnet_scale,
                    generator=gen,
                ).images[0]
            
            elif self.mode == "ultra":
                depth_map = self.depth(img)
                canny_map = self.canny(img, low_threshold=50, high_threshold=130)
                for m in [depth_map, canny_map]:
                    if not isinstance(m, Image.Image): m = Image.fromarray(m)
                out = self.pipe(
                    prompt=pos, negative_prompt=neg,
                    image=img, control_image=[depth_map, canny_map],
                    strength=strength, guidance_scale=guidance_scale,
                    num_inference_steps=num_steps,
                    controlnet_conditioning_scale=[0.80, 0.35],  # Depth dominant
                    generator=gen,
                ).images[0]
        
        return self._post_process(out)
    
    def batch_convert(self, input_dir, output_dir, **kwargs):
        """Process a folder of photos. Saves sketch + side-by-side comparison."""
        from pathlib import Path
        from tqdm import tqdm
        
        in_path  = Path(input_dir)
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)
        
        images = list(in_path.glob("*.jpg")) + list(in_path.glob("*.png"))
        print(f"Processing {len(images)} images...")
        
        for p in tqdm(images, desc="Converting"):
            try:
                src    = Image.open(p).convert("RGB")
                sketch = self.convert(src, **kwargs)
                
                sketch.save(out_path / f"{p.stem}_sketch.jpg", quality=95)
                
                # Comparison: original | sketch
                cmp = Image.new("RGB", (1024, 512))
                cmp.paste(src.resize((512,512), Image.LANCZOS), (0,0))
                cmp.paste(sketch, (512,0))
                cmp.save(out_path / f"{p.stem}_compare.jpg", quality=93)
            
            except torch.cuda.OutOfMemoryError:
                torch.cuda.empty_cache()
            except Exception as e:
                print(f"\nError {p.name}: {e}")


# ─── One-liner usage ──────────────────────────────────────
if __name__ == "__main__":
    # Single image
    converter = PencilSketchConverter(mode="precise")
    result = converter.convert("your_photo.jpg", style="warm_golden", strength=0.62)
    result.save("output_sketch.jpg", quality=95)
    
    # Batch folder
    # converter.batch_convert("./input_photos/", "./output_sketches/") and this # CELL 1 — Install
!pip install diffusers transformers accelerate xformers datasets controlnet-aux scikit-image -q

# CELL 2 — Upload and convert ONE photo immediately
from PIL import Image
import torch

# Upload via Kaggle sidebar or use a test URL
from diffusers import StableDiffusionImg2ImgPipeline

pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
    "stabilityai/stable-diffusion-2-1",
    torch_dtype=torch.float16, safety_checker=None
).to("cuda")
pipe.enable_xformers_memory_efficient_attention()

img = Image.open("/kaggle/input/your-dataset/photo.jpg").resize((512,512))

result = pipe(
    prompt=(
        "colored pencil sketch, hand drawn Prismacolor pencils, "
        "visible pencil strokes, cross-hatching, paper grain texture, "
        "warm amber skin tones, muted colors, fine art illustration quality"
    ),
    negative_prompt="photograph, digital, anime, flat colors, smooth, 3d render",
    image=img,
    strength=0.62,
    guidance_scale=8.0,
    num_inference_steps=40,
    generator=torch.Generator("cuda").manual_seed(42),
).images[0]

result.save("/kaggle/working/sketch_output.jpg", quality=95)
print("Done! Download from Output tab.") give me updated code of this for kaggle we use these three different dataset and make our new final dataset of 30K images dataset and save it as a new dataset and then on it we run the diffusion model as in this to generate the final dataset for training also update the code according to our new requirements we need better quality if image also one more thing we will use t4 x2 GPU for inference means we use the multi gpu on kaggle for inference so that we can do it fast now apply all your knowledge and do it as best as you can