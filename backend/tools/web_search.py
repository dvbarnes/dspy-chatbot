

import os
from typing import List
from tavily import AsyncTavilyClient

env_key = os.getenv("TAVILY_API_KEY")
client = AsyncTavilyClient(api_key=env_key)
async def search_web(query: str, num_result: int = 5)->List[dict]:
    response = await client.search(
        query=query,
        num_result=num_result,
        search_depth="advanced",
        include_answer=True,
        include_raw_content=False,
        include_images=False,
        include_domains=[],
        exclude_domains=[]
    )
    results = []
    for result in response.get("results", []):
        results.append({
            "title": result.get("title", ""),
            "snippet": result.get("content", ""),
            "url": result.get("url", ""),
        })
    
    # Add answer if available
    if response.get("answer"):
        results.insert(0, {
            "title": "AI-Generated Summary",
            "snippet": response["answer"],
            "url": "tavily-answer"
        })
    
    return results
