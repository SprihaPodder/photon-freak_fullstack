from pathlib import Path
import os
import torch
import torch.nn as nn
import timm
from PIL import Image
from torchvision import transforms as T

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SOLARGUARD_CHECKPOINT = BASE_DIR / "solarguard_swa_seed0.pth"

CLASSES = ["Bird-drop", "Clean", "Dusty", "Electrical-damage", "Physical-Damage"]
TRANSFORM = T.Compose([T.Resize((256, 256)), T.CenterCrop(224), T.ToTensor(),
                       T.Normalize([0.485, .456, .406], [.229, .224, .225])])

class ChannelAttention(nn.Module):
    def __init__(self, channels, reduction=16):
        super().__init__(); mid = max(channels // reduction, 8)
        self.fc = nn.Sequential(nn.Linear(channels, mid, bias=False), nn.ReLU(True), nn.Linear(mid, channels, bias=False))
    def forward(self, x):
        w = torch.sigmoid(self.fc(x.mean((2,3))) + self.fc(x.amax((2,3))))
        return x * w[..., None, None]

class SpatialAttention(nn.Module):
    def __init__(self): super().__init__(); self.conv = nn.Conv2d(2, 1, 7, padding=3, bias=False)
    def forward(self, x):
        return x * torch.sigmoid(self.conv(torch.cat([x.mean(1, keepdim=True), x.amax(1, keepdim=True)], 1)))

class CBAM(nn.Module):
    """Kept as a named module so checkpoint keys match the training code."""
    def __init__(self, channels):
        super().__init__()
        self.ca = ChannelAttention(channels)
        self.sa = SpatialAttention()
    def forward(self, x):
        return self.sa(self.ca(x))

class FPNNeck(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.lateral = nn.ModuleList([nn.Conv2d(c, 256, 1) for c in channels])
        self.cbams = nn.ModuleList([CBAM(256) for _ in channels])
        self.pool = nn.AdaptiveAvgPool2d(1)
    def forward(self, features):
        return torch.cat([self.pool(cbam(lateral(x))).flatten(1) for x, lateral, cbam in zip(features, self.lateral, self.cbams)], 1)

class SolarGuardNet(nn.Module):
    def __init__(self):
        super().__init__()
        # pretrained=False is vital in production: checkpoint supplies all learned weights; no download occurs.
        self.backbone = timm.create_model("tf_efficientnetv2_s", pretrained=False, features_only=True, out_indices=(1,3,4))
        self.fpn = FPNNeck(self.backbone.feature_info.channels())
        self.head = nn.Sequential(nn.LayerNorm(768), nn.Linear(768,512), nn.GELU(), nn.Dropout(.4),
                                  nn.Linear(512,256), nn.GELU(), nn.Dropout(.2), nn.Linear(256,5))
    def forward(self, x): return self.head(self.fpn(self.backbone(x)))

class Predictor:
    def __init__(self):
        checkpoint = os.getenv("SOLARGUARD_CHECKPOINT")

        if checkpoint:
            path = Path(checkpoint).expanduser()
        else:
            path = SOLARGUARD_CHECKPOINT

        if not path.is_file():
            raise RuntimeError(f"Checkpoint not found: {path}")

        model = SolarGuardNet()
        checkpoint = torch.load(path, map_location="cpu", weights_only=True)

        if isinstance(checkpoint, dict):
            if "state_dict" in checkpoint:
                state_dict = checkpoint["state_dict"]
            elif "model_state_dict" in checkpoint:
                state_dict = checkpoint["model_state_dict"]
            else:
                state_dict = checkpoint
        else:
            state_dict = checkpoint

        state_dict.pop("n_averaged", None)

        state_dict = {
            k.replace("module.", "", 1): v
            for k, v in state_dict.items()
        }

        model.load_state_dict(state_dict, strict=True)
        model.eval()

        self.models = [model]
        
    @property
    def ready(self): return bool(self.models)
    @torch.inference_mode()
    def predict(self, image: Image.Image):
        if not self.ready: raise RuntimeError("SOLARGUARD_CHECKPOINT is not configured")
        x = TRANSFORM(image.convert("RGB")).unsqueeze(0)
        probabilities = torch.stack([torch.softmax(model(x), 1)[0] for model in self.models]).mean(0)
        index = int(probabilities.argmax())
        return {"label": CLASSES[index], "confidence": round(float(probabilities[index]) * 100, 2),
                "probabilities": [{"label": name, "probability": round(float(probabilities[i]) * 100, 2)} for i, name in enumerate(CLASSES)]}
