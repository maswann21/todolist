from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI()

# ----- Models -----
class TodoCreate(BaseModel):
    title: str

class Todo(BaseModel):
    id: int
    title: str
    completed: bool = False

# ----- In-memory "DB" -----
todos: List[Todo] = []
next_id = 1


@app.get("/")
def read_root():
    return {"msg": "todolist api running"}


# Create
@app.post("/todos", response_model=Todo)
def create_todo(payload: TodoCreate):
    global next_id
    todo = Todo(id=next_id, title=payload.title, completed=False)
    todos.append(todo)
    next_id += 1
    return todo


# Read (list)
@app.get("/todos", response_model=list[Todo])
def list_todos():
    return todos


# Update
@app.put("/todos/{todo_id}", response_model=Todo)
def update_todo(todo_id: int, payload: TodoCreate):
    for i, t in enumerate(todos):
        if t.id == todo_id:
            updated = Todo(id=t.id, title=payload.title, completed=t.completed)
            todos[i] = updated
            return updated
    raise HTTPException(status_code=404, detail="Todo not found")


# Toggle completed
@app.patch("/todos/{todo_id}/toggle", response_model=Todo)
def toggle_todo(todo_id: int):
    for i, t in enumerate(todos):
        if t.id == todo_id:
            updated = Todo(id=t.id, title=t.title, completed=not t.completed)
            todos[i] = updated
            return updated
    raise HTTPException(status_code=404, detail="Todo not found")


# Delete
@app.delete("/todos/{todo_id}")
def delete_todo(todo_id: int):
    for i, t in enumerate(todos):
        if t.id == todo_id:
            todos.pop(i)
            return {"ok": True}
    raise HTTPException(status_code=404, detail="Todo not found")
