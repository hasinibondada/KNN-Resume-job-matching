# KNN Resume Job Matching

A full-stack web application that uses K-Nearest Neighbors (KNN) to predict resume-job fit.

## Features

- **Dashboard** – View dataset statistics, model accuracy, and job fit distribution
- **Candidates Browser** – Search, filter, and browse all 200 candidates with actual vs predicted job fit
- **Job Fit Predictor** – Input candidate features and get instant KNN-based predictions with probabilities and nearest neighbors

## Tech Stack

- **Backend:** Python Flask, scikit-learn, pandas
- **Frontend:** HTML, CSS, JavaScript
- **Model:** KNN (K=11, Accuracy: 75%)

## Setup

```bash
pip install flask pandas scikit-learn openpyxl numpy
python app.py
```

Open http://127.0.0.1:5000 in your browser.
