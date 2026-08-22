import torch
import bitsandbytes as bnb

print("torch:", torch.__version__, "cuda:", torch.version.cuda)
print("device:", torch.cuda.get_device_name(0), "capability:", torch.cuda.get_device_capability(0))

x = torch.randn(8, 128, device="cuda", dtype=torch.bfloat16)
layer = bnb.nn.Linear4bit(128, 128, bias=False, compute_dtype=torch.bfloat16).cuda()
print("running 4-bit matmul...")
y = layer(x)
torch.cuda.synchronize()
print("OK, output shape:", y.shape)
