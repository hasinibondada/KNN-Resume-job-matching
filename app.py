import pandas as pd
import numpy as np
from flask import Flask, render_template, request, jsonify
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score
import json

app = Flask(__name__)

df = pd.read_excel("KNN_Resume_Job_Matching_Dataset.xlsx")

JOB_ROLES = {1: "Software Engineer", 2: "Data Scientist", 3: "DevOps Engineer", 4: "Product Manager"}

label_encoders = {}
for col in df.columns:
    if pd.api.types.is_string_dtype(df[col]) or df[col].dtype.name == "object":
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col])
        label_encoders[col] = le

feature_cols = [c for c in df.columns if c not in ("Candidate_ID", "Job_Fit")]
X = df[feature_cols].values
y = df["Job_Fit"].values

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

knn = KNeighborsClassifier(n_neighbors=11)
knn.fit(X_train, y_train)

accuracy = accuracy_score(y_test, knn.predict(X_test))

fit_encoder = label_encoders["Job_Fit"]

def fit_label(val):
    return fit_encoder.inverse_transform([int(val)])[0]

df_original = pd.read_excel("KNN_Resume_Job_Matching_Dataset.xlsx")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/candidates")
def get_candidates():
    job_role = request.args.get("job_role", type=int)
    fit_filter = request.args.get("fit")
    search = request.args.get("search", "").strip().lower()

    data = df_original.copy()
    predictions = knn.predict(X_scaled)
    data["Predicted_Fit"] = [fit_label(p) for p in predictions]
    data["Job_Role"] = data["Job_Role_Code"].map(JOB_ROLES)

    if job_role:
        data = data[data["Job_Role_Code"] == job_role]
    if fit_filter:
        data = data[data["Predicted_Fit"] == fit_filter]
    if search:
        data = data[data["Candidate_ID"].str.lower().str.contains(search)]

    cols = ["Candidate_ID", "Years_of_Experience", "Skill_Match_Score",
            "Programming_Skill_Level", "Domain_Knowledge_Level", "Certifications_Count",
            "Coding_Test_Score", "Communication_Score", "Job_Role_Code", "Job_Role", "Job_Fit", "Predicted_Fit"]
    data = data[cols]
    data = data.sort_values("Predicted_Fit", ascending=False)

    return jsonify({
        "candidates": data.to_dict(orient="records"),
        "total": len(data),
        "all": len(df_original)
    })

@app.route("/api/predict", methods=["POST"])
def predict():
    body = request.get_json()
    features = [
        body.get("years_experience", 0),
        body.get("skill_match_score", 0),
        body.get("programming_level", 1),
        body.get("domain_knowledge", 1),
        body.get("certifications", 0),
        body.get("coding_test_score", 0),
        body.get("communication_score", 1),
        body.get("job_role_code", 1),
    ]
    features_arr = np.array([features], dtype=float)
    features_scaled = scaler.transform(features_arr)
    pred = knn.predict(features_scaled)[0]
    probs = knn.predict_proba(features_scaled)[0]

    distances, indices = knn.kneighbors(features_scaled, n_neighbors=11)
    neighbors = []
    for i, idx in enumerate(indices[0]):
        row = df_original.iloc[idx]
        neighbors.append({
            "candidate_id": row["Candidate_ID"],
            "distance": round(distances[0][i], 4),
            "job_fit": row["Job_Fit"],
        })

    return jsonify({
        "prediction": fit_label(pred),
        "probabilities": {
            fit_label(i): round(float(probs[j]), 4)
            for j, i in enumerate(knn.classes_)
        },
        "neighbors": neighbors,
    })

@app.route("/api/stats")
def stats():
    total = len(df_original)
    role_counts = df_original["Job_Role_Code"].value_counts().to_dict()
    fit_counts = df_original["Job_Fit"].value_counts().to_dict()
    pred_fits = [fit_label(p) for p in knn.predict(X_scaled)]
    pred_counts = pd.Series(pred_fits).value_counts().to_dict()

    return jsonify({
        "total_candidates": total,
        "k_neighbors": 11,
        "accuracy": round(float(accuracy), 4),
        "job_roles": {str(k): {"name": v, "count": role_counts.get(k, 0)} for k, v in JOB_ROLES.items()},
        "actual_fit_distribution": fit_counts,
        "predicted_fit_distribution": pred_counts,
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)
