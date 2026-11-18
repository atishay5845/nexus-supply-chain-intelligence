# Optional Microsoft Agent Framework + Ollama setup

The deterministic application runs without an API key or model. Use this setup for the Microsoft Agent Framework demonstration path in the viva.

1. Install and start [Ollama](https://ollama.com/).
2. Download a tool-capable local model:

```bash
ollama pull qwen3:4b
```

3. Activate the backend virtual environment and install the connector:

```bash
pip install --pre -r requirements-ai.txt
```

4. Set the model name before starting FastAPI:

```powershell
# Windows PowerShell
$env:OLLAMA_MODEL="qwen3:4b"
$env:NEXUS_OLLAMA_MODEL="qwen3:4b"
```

```bash
# macOS / Linux
export OLLAMA_MODEL="qwen3:4b"
export NEXUS_OLLAMA_MODEL="qwen3:4b"
```

5. Restart FastAPI. The **Optional local AI annotations** switch becomes available when Microsoft Agent Framework and its Ollama connector are installed.

The first local-model run may take longer while the model loads. Five separate framework agents review their corresponding verified worker posts. The AI commentary is advisory only. All stock, capacity, price and route calculations, plus the final mitigation decision, remain deterministic Python logic. No paid API is required.

If Ollama is not running or the connector is unavailable, the deterministic run is retained and the UI displays a warning. The project does not require the AI layer to run tests or demonstrate the blackboard workflow.
