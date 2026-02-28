import os
import modal

# 1. Define the Modal App and the required container image
app = modal.App("parallellm-trial-server")

# Use an image that has vLLM and OpenAI-compatible server dependencies pre-installed
vllm_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm==0.6.6",
        "transformers==4.46.3",
        "hf_transfer",
        "fastapi[standard]",
        "openai>=1.52.0", # Needed for validation
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

# 2. Configuration for the model
# You can change this to "Qwen/Qwen2.5-7B-Instruct" or "google/gemma-2-9b-it"
MODEL_ID = "NousResearch/Meta-Llama-3-8B-Instruct" 

# Set up the VRAM requirements. RTX 3090/4090 class (24GB) is great for 8B models.
# Modal bills by the true second of compute used.
GPU_CONFIG = "A10G" # Or use "L4" for cheaper inference

# 3. Define the secrets and the inference endpoint
# The secret `TRIAL_LLM_API_KEY` must be set in your Modal Dashboard (modal.com/secrets)
@app.cls(
    image=vllm_image,
    gpu=GPU_CONFIG,
    allow_concurrent_inputs=100,  # We bring this back, latest Modal warns but fallback works, or we omit entirely
    scaledown_window=300,
    timeout=600,
    secrets=[modal.Secret.from_name("custom-llm-auth-secret")]
)
class VLLMServer:
    @modal.enter()
    def setup(self):
        """
        Runs once when the container starts (Cold Start).
        Loads the model weights into the GPU memory using vLLM's AsyncLLMEngine.
        """
        import vllm
        from vllm.engine.arg_utils import AsyncEngineArgs
        from vllm.engine.async_llm_engine import AsyncLLMEngine
        
        # NOTE: If using Llama 3 or Gemma, you must accept the agreement on HuggingFace 
        # and provide your HF_TOKEN in the Modal Secrets dashboard.
        
        print(f"Loading {MODEL_ID} into VRAM...")
        engine_args = AsyncEngineArgs(
            model=MODEL_ID,
            tensor_parallel_size=1,
            gpu_memory_utilization=0.90,
            max_model_len=8192,
            dtype="auto",
        )
        self.engine = AsyncLLMEngine.from_engine_args(engine_args)
        print("Model loaded successfully!")

    @modal.asgi_app(label="v1")
    def serve(self):
        from fastapi import FastAPI, Request, HTTPException
        from fastapi.responses import StreamingResponse
        from vllm import SamplingParams
        import uuid
        import json
        
        web_app = FastAPI()

        @web_app.post("/chat/completions")
        @web_app.post("/v1/chat/completions")
        async def chat_completions(req: Request):
            """
            The actual Next.js compatible OpenAI /chat/completions endpoint.
            Secured by requiring a Bearer token that matches TRIAL_LLM_API_KEY.
            """
            # 4. Security Check: Validate the Authorization header
            auth_header = req.headers.get("Authorization")
            expected_token = os.environ.get("TRIAL_LLM_API_KEY")
            
            if not expected_token:
                raise HTTPException(status_code=500, detail="Server misconfiguration: No TRIAL_LLM_API_KEY set.")
                
            if not auth_header or not auth_header.startswith("Bearer "):
                raise HTTPException(status_code=401, detail="Unauthorized: Expected Bearer token")
                
            token = auth_header.split(" ")[1]
            if token != expected_token:
                raise HTTPException(status_code=403, detail="Forbidden: Invalid API Key")

            # 5. Process the Request via vLLM
            request = await req.json()
            
            messages = request.get("messages", [])
            # Very basic prompt formatting. For production, use a proper tokenizer template.
            # e.g., self.engine.get_model_config().get_tokenizer()
            prompt = ""
            for msg in messages:
                prompt += f"<|start_header_id|>{msg['role']}<|end_header_id|>\n\n{msg['content']}<|eot_id|>\n"
            prompt += "<|start_header_id|>assistant<|end_header_id|>\n\n"

            sampling_params = SamplingParams(
                temperature=request.get("temperature", 0.7),
                max_tokens=request.get("max_tokens", 4096),
            )
            
            request_id = f"cmpl-{str(uuid.uuid4())}"
            
            stream = await self.engine.add_request(request_id, prompt, sampling_params)
            
            async def stream_generator():
                previous_texts = [""] * 1
                async for request_output in stream:
                    for i, output in enumerate(request_output.outputs):
                        text = output.text
                        delta_text = text[len(previous_texts[i]):]
                        previous_texts[i] = text
                        
                        if delta_text:
                            chunk = {
                                "id": request_id,
                                "object": "chat.completion.chunk",
                                "model": request.get("model", MODEL_ID),
                                "choices": [
                                    {
                                        "index": 0,
                                        "delta": {"content": delta_text},
                                        "finish_reason": None
                                    }
                                ]
                            }
                            yield f"data: {json.dumps(chunk)}\n\n"
                            
                # Final chunk
                final_chunk = {
                    "id": request_id,
                    "object": "chat.completion.chunk",
                    "model": request.get("model", MODEL_ID),
                    "choices": [
                        {
                            "index": 0,
                            "delta": {},
                            "finish_reason": "stop"
                        }
                    ]
                }
                yield f"data: {json.dumps(final_chunk)}\n\n"
                yield "data: [DONE]\n\n"

            return StreamingResponse(stream_generator(), media_type="text/event-stream")

        return web_app

# To deploy, run:
# modal deploy scripts/modal/vllm_server.py

@app.local_entrypoint()
def main():
    print("\n🚀 Ready to deploy your Serverless GPU endpoint!")
    print("\n1. First, create your authorization secret:")
    print("   modal secret create custom-llm-auth-secret TRIAL_LLM_API_KEY=your_password_here")
    print("\n2. Deploy the endpoint:")
    print("   modal deploy scripts/modal/vllm_server.py")
    print("\n3. Look for the 'Created web_endpoint' URL in the deployment output above.")
    print("   It will look something like:")
    print("   https://your_workspace--parallellm-trial-server-vllmserver-chat-completions.modal.run")
    print("\n4. Set that URL as TRIAL_LLM_BASE_URL in your .env.local file!\n")
