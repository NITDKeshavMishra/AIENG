import os
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq


load_dotenv()
my_api_key=os.getenv("GROQ_API_KEY")

if not my_api_key:
    raise ValueError("API key not found")

client=Groq(api_key=my_api_key)

model="openai/gpt-oss-20b"

def llm_ans(prompt):
    message={
        "role": "user",
        "content": prompt
    }
    messages=[message]
    response=client.chat.completions.create(model=model, messages=messages)
    answer=response.choices[0].message.content
    return answer

bad_prompt=""""
#Role
You are a support assistant at a mobile/laptop company.
#Task
You have to classify the issue in a category
#CONSTRAINTS
You have to classify the issue in one of the three categories namely billing, technical, return
#OUTPUT FORMAT
Your answer should be in one word only. The one word should be one of the categories given in the constraints
This is a user complaint:
I am not happy with my mobile. I want a refund


    """

print(llm_ans(bad_prompt))