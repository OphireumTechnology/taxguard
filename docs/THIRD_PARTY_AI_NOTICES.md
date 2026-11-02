# Third-party AI notices

Ophir AI and Ophir Model are the names under which Ophireum Technology operates a private, locally hosted AI model. They are
a brand and a configuration. **Ophireum Technology did not create or train the underlying model weights or the inference
software, and does not exclusively own them.**

| Component | Identifier | Creator | Licence |
|---|---|---|---|
| Model weights | Qwen3 8B (`qwen3:8b`, Q4_K_M) | Qwen team, Alibaba Cloud | Apache License 2.0 |
| Inference engine | Ollama 0.40.13 | Ollama Inc. | MIT License |

`ophir-model:8b` is the same weights with an operator-written system prompt and temperature setting. No weights were changed
or retrained.

The licence text of the installed model can be read on the machine with `ollama show qwen3:8b --license`. The weights are
not redistributed by this project, and `local-ai/` is excluded from Git. Any redistribution would have to keep the licence
and notices.

Ordinary user-facing screens show only the brand. Authorized administrators see this provenance in the AI Control Center
(`Local model` tab), and audit records keep the actual provider and model.
