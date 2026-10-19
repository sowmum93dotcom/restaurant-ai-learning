# Runpod checkpoint — owner-provided evidence, 18 October 2026

These results were shown in the owner's terminal and Runpod console screenshots. They are not measurements independently executed from this checkout.

- Pod: `visual_gray_ladybug` (`xm3g09qr8v4xkr`), NVIDIA L4, 23,034 MiB VRAM. Console allocation: six vCPU, 62 GB RAM, 30 GB container disk, EU-RO-1. Host-wide `free` output is not the pod's memory allocation.
- Image: `runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404`. Python 3.12.3, PyTorch 2.8.0+cu128, Git 2.43.0 and FFmpeg 6.1.1 were reported; CUDA availability was true.
- The PR branch cloned into `/root/demeos`. Cloning into `/workspace` failed because the mounted Global volume did not support Git's chmod operation.
- `/root/demeos-venv` used system site packages. Added versions: transformers 4.57.6, accelerate 1.12.0, safetensors 0.7.0 and huggingface-hub 0.36.0. This reused the image's PyTorch installation.
- `Qwen/Qwen3-VL-4B-Instruct`, snapshot `ebb281ec70b05090aa6165b016eac8ec08e71b17`, was downloaded into `/root/demeos-model`. The download used `HF_HUB_ENABLE_HF_TRANSFER=0` because the image enabled fast transfer without the `hf_transfer` package.
- Local BF16/SDPA model loading on `cuda:0` succeeded with `local_files_only=True`, `trust_remote_code=False` and safetensors. A genuine synthetic solid-red image inference returned `red`.
- That result establishes basic GPU loading and image inference only. It does not establish product recognition quality, ten-language accuracy, the existing two-second deadline, throughput, cost per analysis or readiness for customer data.
- A copy to `/workspace/demeos-model` was started. A subsequent directory listing showed all 13 expected files, totaling 6.8 GB, including both 4.7 GB and 2.2 GB weight shards. The full byte comparison did not produce a visible completion result before the browser terminal disconnected. **Integrity of the stored copy remains unverified.**
- The environment list was saved successfully to `/workspace/demeos-requirements.txt` using `pip freeze --local`. It records additions in the virtual environment, not the entire base image.
- The Volumes tab showed Global volume `dizzy_indigo_worm`, mounted at `/workspace`, about 7 GB stored. The Stop dialog separately warned that no volume was configured; this warning must not be treated as proof about the Global volume's contents.
- The final console screenshot showed the pod stopped, compute and container storage not running, and pod total $0.00/hour. This is a historical screenshot, not a current billing check. Global storage may incur separate charges.

On resumption, confirm the Global volume is attached and validate the saved model before downloading it again. `/root` contained the temporary checkout and virtual environment; do not assume they survive the stop. Use the saved environment list and matching base image if restoration is needed. Obtain the current connection details from the console rather than reusing an old SSH endpoint.

No private model service has been built or connected to Selling. Genuine product Analyse/review integration, isolation attestation and deployed owner acceptance remain unfinished. PR #708 remains draft and unmerged; Production activation is not authorised.
