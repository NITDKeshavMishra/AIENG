import os
import json
import ast
import operator

from dotenv import load_dotenv
from groq import Groq


load_dotenv()

my_api_key = os.getenv("GROQ_API_KEY")

if not my_api_key:
    raise ValueError("API key kaha hai bhai")


client = Groq(api_key=my_api_key)
model = "openai/gpt-oss-20b"


# ---------------- Tools ----------------

def get_product_price(product: str) -> int:
    prices = {
        "iPhone 17": 1000,
        "iPhone 15": 500,
    }
    return prices.get(product.strip(), 0)


SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
}


def calculator(expression: str):
    """
    Safely calculates simple arithmetic expressions.
    Example: 5000 - 1000
    """
    try:
        expression = expression.strip()

        if not expression:
            return "calc error!"

        tree = ast.parse(expression, mode="eval")

        def evaluate(node):
            if isinstance(node, ast.Constant):
                if isinstance(node.value, (int, float)):
                    return node.value
                raise ValueError("Only numbers are allowed")

            if isinstance(node, ast.BinOp):
                if type(node.op) not in SAFE_OPERATORS:
                    raise ValueError("Operator not allowed")

                left = evaluate(node.left)
                right = evaluate(node.right)
                return SAFE_OPERATORS[type(node.op)](left, right)

            if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
                return -evaluate(node.operand)

            raise ValueError("Invalid expression")

        return evaluate(tree.body)

    except Exception:
        return "calc error!"


available_tools = {
    "get_product_price": get_product_price,
    "calculator": calculator,
}


# ---------------- Tool schemas for Groq ----------------

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_product_price",
            "description": "Get the price of a product in rupees.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product": {
                        "type": "string",
                        "description": "Name of the product, for example iPhone 17"
                    }
                },
                "required": ["product"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculator",
            "description": "Calculate a simple arithmetic expression.",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Arithmetic expression, for example 5000 - 1000"
                    }
                },
                "required": ["expression"]
            }
        }
    }
]


# ---------------- Agent ----------------

system_prompt = """
You are a shopping assistant.

Use the provided tools when needed.

First find the product price.
Then calculate how much money will be left.
Finally give a clear final answer to the user.
"""


def run_agent(question: str, max_steps: int = 5):
    messages = [
        {
            "role": "system",
            "content": system_prompt
        },
        {
            "role": "user",
            "content": question
        }
    ]

    for step in range(max_steps):
        print("\n------------------")
        print("STEP", step + 1)
        print("------------------")

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0
        )

        message = response.choices[0].message

        # If the model wants to call a tool
        if message.tool_calls:
            messages.append(message)

            for tool_call in message.tool_calls:
                function_name = tool_call.function.name
                arguments = tool_call.function.arguments

                print(f"Tool call: {function_name}")
                print(f"Arguments: {arguments}")

                try:
                    args = json.loads(arguments)
                except json.JSONDecodeError:
                    args = {}

                if function_name == "get_product_price":
                    result = get_product_price(args.get("product", ""))
                elif function_name == "calculator":
                    result = calculator(args.get("expression", ""))
                else:
                    result = "Tool not found"

                print("Observation:", result)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(result)
                })

            continue

        # If the model gives the final answer
        final_answer = message.content

        if final_answer:
            print("\nFINAL ANSWER:")
            print(final_answer)
            break

        print("Model returned no content.")
        break


# ---------------- Run ----------------

prompt = """
I have 5000 rupees. What is the price of an iPhone 17?
And how much money will I have left?
"""

run_agent(prompt)