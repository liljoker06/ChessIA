import chess
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = "alexneakameni/Qwen2.5-Coder-0.5B-Instruct-chess-grpo"

FENS = [
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    "r3k2r/pppq1ppp/2n1bn2/1B2p3/1b2P3/2N2N2/PPPQ1PPP/R3K2R w KQkq - 6 8",
    "8/8/8/4k3/8/4K3/8/4R3 w - - 0 1",
]

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
    device_map={"": 0} if torch.cuda.is_available() else None,
)

system_msg = (
    "You are a chess engine. Given a FEN position, the side to move, and the "
    "list of legal moves in UCI format, respond with your reasoning in "
    "<rationale></rationale> tags and your chosen move in <uci_move></uci_move> tags."
)

legal_count = 0
for fen in FENS:
    board = chess.Board(fen)
    side_to_move = "White" if board.turn == chess.WHITE else "Black"
    legal_moves_uci = " ".join(m.uci() for m in board.legal_moves)
    user_msg = f"FEN: {fen}\nSide to move: {side_to_move}\nLegal moves (UCI): {legal_moves_uci}"

    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
    ]
    chat = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(chat, return_tensors="pt").to(model.device)
    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=64,
            do_sample=True,
            temperature=1.0,
            top_p=0.95,
            top_k=64,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )
    completion = tokenizer.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)

    import re
    match = re.search(r"<uci_move>\s*([a-h][1-8][a-h][1-8][qrbn]?)\s*</uci_move>", completion)
    uci = match.group(1) if match else None
    try:
        legal = uci is not None and chess.Move.from_uci(uci) in board.legal_moves
    except ValueError:
        legal = False
    if legal:
        legal_count += 1
    print(f"FEN={fen[:30]}... -> uci_move={uci!r} legal={legal}")

print(f"\n{legal_count}/{len(FENS)} legal moves")
