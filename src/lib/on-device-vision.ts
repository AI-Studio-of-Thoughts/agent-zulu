/**
 * On-Device Vision Engine — Offline sovereign inference via Transformers.js.
 *
 * Runs a lightweight image classification model (MobileNet) directly in the
 * browser. Classifies scenes and maps labels to culturally-rich African
 * responses with isiZulu proverbs and symbolism.
 *
 * Designed for:
 * - Load-shedding / rural low-connectivity Africa
 * - Privacy-first local inference
 * - Fallback when sovereign backend is unreachable
 *
 * Model: Xenova/mobilenet_v2_1.0_224 (~14MB, fast on mobile)
 */

import { pipeline } from "@huggingface/transformers";

// Cultural response templates mapped to common scene categories
interface CulturalResponse {
  description_zu: string;
  description_en: string;
  emotion: string;
  intensity: number;
  isaga?: string; // proverb
}

// Map ImageNet labels to cultural responses
const CULTURAL_MAPPINGS: Record<string, CulturalResponse> = {
  // People & faces
  person: {
    description_zu: "Ngibona umuntu — umuntu ngumuntu ngabantu.",
    description_en: "I see a person — a person is a person through others.",
    emotion: "empathetic",
    intensity: 0.6,
    isaga: "Umuntu ngumuntu ngabantu.",
  },
  // Food
  food: {
    description_zu: "Ngibona ukudla — isisu somhambi asingakanani.",
    description_en: "I see food — a traveller's stomach is small.",
    emotion: "empathetic",
    intensity: 0.5,
    isaga: "Isisu somhambi asingakanani, singangenso yenyoni.",
  },
  // Nature / outdoors
  nature: {
    description_zu: "Ngibona imvelo enhle — umhlaba wethu omuhle.",
    description_en: "I see beautiful nature — our beautiful land.",
    emotion: "empathetic",
    intensity: 0.5,
    isaga: "Izulu liyeza, liyasithela.",
  },
  // Animals
  animal: {
    description_zu: "Ngibona isilwane — indlovu ayisindwa umboko wayo.",
    description_en: "I see an animal — an elephant is not burdened by its trunk.",
    emotion: "thinking",
    intensity: 0.5,
    isaga: "Indlovu ayisindwa umboko wayo.",
  },
  // Indoor / home
  indoor: {
    description_zu: "Ngibona indlu — ikhaya lethu.",
    description_en: "I see indoors — our home.",
    emotion: "neutral",
    intensity: 0.3,
    isaga: "Inkunzi isematholeni.",
  },
  // Objects / general
  object: {
    description_zu: "Ngibona into — ake ngibheke kahle.",
    description_en: "I see something — let me look closer.",
    emotion: "thinking",
    intensity: 0.4,
  },
  // Dark / night
  dark: {
    description_zu: "Kusemnyameni — kodwa ukukhanya kuyeza.",
    description_en: "It is dark — but light is coming.",
    emotion: "neutral",
    intensity: 0.2,
    isaga: "Emva kobumnyama kuza ukukhanya.",
  },
};

// ImageNet label → category mapping (common labels)
const LABEL_CATEGORIES: Record<string, string> = {
  // People
  "jersey": "person", "suit": "person", "lab coat": "person",
  "military uniform": "person", "academic gown": "person",
  // Food
  "pizza": "food", "cheeseburger": "food", "plate": "food",
  "cup": "food", "coffee mug": "food", "bowl": "food",
  "banana": "food", "orange": "food", "apple": "food",
  "meat loaf": "food", "bread": "food",
  // Nature
  "cliff": "nature", "valley": "nature", "mountain": "nature",
  "lakeside": "nature", "seashore": "nature", "volcano": "nature",
  "flower": "nature", "daisy": "nature", "sunflower": "nature",
  "tree": "nature", "coral reef": "nature",
  // Animals
  "dog": "animal", "cat": "animal", "bird": "animal",
  "fish": "animal", "elephant": "animal", "lion": "animal",
  "zebra": "animal", "giraffe": "animal", "cow": "animal",
  "horse": "animal", "chicken": "animal", "snake": "animal",
  // Indoor
  "desk": "indoor", "monitor": "indoor", "laptop": "indoor",
  "keyboard": "indoor", "mouse": "indoor", "television": "indoor",
  "bookcase": "indoor", "chair": "indoor", "table": "indoor",
  "bed": "indoor", "lamp": "indoor", "couch": "indoor",
};

function getCategory(label: string): string {
  const lower = label.toLowerCase();
  // Direct match
  if (LABEL_CATEGORIES[lower]) return LABEL_CATEGORIES[lower];
  // Partial match
  for (const [key, cat] of Object.entries(LABEL_CATEGORIES)) {
    if (lower.includes(key) || key.includes(lower)) return cat;
  }
  return "object";
}

  private classifier: any = null;
  private loading = false;
  private ready = false;
  private _loadProgress = 0;

  get isReady() { return this.ready; }
  get loadProgress() { return this._loadProgress; }

  async initialize(): Promise<boolean> {
    if (this.ready) return true;
    if (this.loading) return false;

    this.loading = true;
    try {
      console.log("[OnDevice] Loading MobileNet model...");
      this.classifier = await pipeline(
        "image-classification",
        "Xenova/mobilenet_v2_1.0_224",
        {
          progress_callback: (progress: any) => {
            if (progress.status === "progress" && progress.progress) {
              this._loadProgress = Math.round(progress.progress);
            }
          },
        }
      ) as ImageClassificationPipeline;
      this.ready = true;
      this._loadProgress = 100;
      console.log("[OnDevice] Model loaded successfully");
      return true;
    } catch (err) {
      console.error("[OnDevice] Failed to load model:", err);
      this.loading = false;
      return false;
    }
  }

  async classifyFrame(imageBlob: Blob): Promise<{
    description: string;
    emotion: string;
    intensity: number;
    notes_zu: string;
    source: string;
    labels: Array<{ label: string; score: number }>;
  }> {
    if (!this.classifier) {
      return {
        description: "Uhlelo lwangaphakathi alukasebenzi. (On-device model not loaded.)",
        emotion: "neutral",
        intensity: 0.2,
        notes_zu: "",
        source: "on-device-offline",
        labels: [],
      };
    }

    try {
      // Convert blob to data URL for Transformers.js
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

      const results = await this.classifier(dataUrl, { topk: 3 });
      const topResult = Array.isArray(results) ? results[0] : results;
      const allResults = Array.isArray(results) ? results : [results];

      const topLabel = topResult?.label || "unknown";
      const topScore = topResult?.score || 0;
      const category = getCategory(topLabel);
      const cultural = CULTURAL_MAPPINGS[category] || CULTURAL_MAPPINGS.object;

      // Build rich response
      const description = topScore > 0.3
        ? `${cultural.description_zu} (${topLabel}: ${(topScore * 100).toFixed(0)}%)`
        : cultural.description_zu;

      return {
        description,
        emotion: cultural.emotion,
        intensity: cultural.intensity,
        notes_zu: cultural.isaga || "",
        source: "on-device",
        labels: allResults.map((r: any) => ({ label: r.label, score: r.score })),
      };
    } catch (err) {
      console.error("[OnDevice] Classification error:", err);
      return {
        description: "Angikwazanga ukubona kahle. (Could not process frame locally.)",
        emotion: "neutral",
        intensity: 0.2,
        notes_zu: "",
        source: "on-device-error",
        labels: [],
      };
    }
  }

  /**
   * Analyze brightness of a frame (for dark scene detection)
   */
  async analyzeBrightness(imageBlob: Blob): Promise<number> {
    try {
      const bitmap = await createImageBitmap(imageBlob);
      const canvas = new OffscreenCanvas(64, 64);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0, 64, 64);
      const imageData = ctx.getImageData(0, 0, 64, 64);
      const data = imageData.data;
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      return totalBrightness / (data.length / 4) / 255;
    } catch {
      return 0.5;
    }
  }

  destroy() {
    this.classifier = null;
    this.ready = false;
    this.loading = false;
  }
}

// Singleton
let _engine: OnDeviceVisionEngine | null = null;

export function getOnDeviceEngine(): OnDeviceVisionEngine {
  if (!_engine) {
    _engine = new OnDeviceVisionEngine();
  }
  return _engine;
}
