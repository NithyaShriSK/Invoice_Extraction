import torch

print("CUDA available:", torch.cuda.is_available())
print("CUDA version:", torch.version.cuda)
print("Device name:", torch.cuda.get_device_name(0))
print("Device capability:", torch.cuda.get_device_capability(0))

x = torch.rand(3,3).cuda()
print("Tensor device:", x.device)