#!/bin/sh
# Prepare files and the dedicated user only. Does not start a service or a Pod.
set -eu
umask 022
[ "$(id -u)" -eq 0 ] || { echo 'Run preparation as root inside the chosen GPU container.'; exit 1; }
runtime_source=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
runtime_root=/opt/demeos-visual-runtime
python3 -c "import torch; assert torch.__version__ == '2.8.0+cu128'; assert torch.cuda.is_available(); print('Existing PyTorch and CUDA confirmed.')"
if ! id demeos-ai >/dev/null 2>&1; then
  useradd --system --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin demeos-ai
fi
install -d -m 755 "$runtime_root"
for runtime_file in contracts.py worker.py server.py inspect_model.py benchmark.py stage_model.py; do
  install -m 644 "$runtime_source/$runtime_file" "$runtime_root/$runtime_file"
done
python3 -m venv --system-site-packages "$runtime_root/venv"
"$runtime_root/venv/bin/python" -m pip install --no-cache-dir transformers==4.57.6 accelerate==1.12.0 safetensors==0.7.0 huggingface-hub==0.36.0 tokenizers==0.22.2
"$runtime_root/venv/bin/python" -m pip freeze > "$runtime_root/environment.txt"
install -d -m 700 -o demeos-ai -g demeos-ai "$runtime_root/secrets"
if [ ! -e "$runtime_root/secrets/runtime.key" ]; then
  python3 -c "import pathlib,secrets; pathlib.Path('/opt/demeos-visual-runtime/secrets/runtime.key').write_text(secrets.token_hex(32)+'\n')"
  chown demeos-ai:demeos-ai "$runtime_root/secrets/runtime.key"
  chmod 600 "$runtime_root/secrets/runtime.key"
fi
printf '%s\n' 'Service files prepared. No model service or Pod was started.' 'The secret is in /opt/demeos-visual-runtime/secrets/runtime.key; keep it out of screenshots and logs.' 'Verify the model copy, configure the private HTTPS route, and run the benchmark before enabling dashboard execution.'
