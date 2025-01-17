const axios = require('axios');

const SPOONACULAR_API_KEY = '23a7bcbc7632490a9d0cbdd754f79fcc'; // Your API key

// List of common meat ingredients to check against
const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'seafood'];

// Function to filter out non-vegetarian ingredients
const filterNonVegetarianIngredients = (ingredients) => {
    return ingredients.filter(ingredient => !meatKeywords.includes(ingredient.toLowerCase()));
};

// Function to clean recipe names
const cleanRecipeName = (title) => {
    return title.replace(/^How to Make\s+/i, ''); // Remove 'How to' at the beginning of the title
};

// Function to check for API rate limit errors
const checkRateLimit = (response) => {
    const remaining = response.headers['x-ratelimit-remaining'];
    const reset = response.headers['x-ratelimit-reset'];

    if (remaining && remaining <= 0) {
        const resetTime = new Date(reset * 1000);
        return `API rate limit exceeded. Try again after ${resetTime.toLocaleString()}.`;
    }
    return null;
};

module.exports = async (req, res) => {
    const { ingredients, diet } = req.query; // Get ingredients and diet from query parameters
    
    if (!ingredients) {
        return res.status(400).json({ error: 'Please provide valid ingredients.' });
    }

    let ingredientList = ingredients.split(','); // Split into an array

    if (diet && diet.toLowerCase() === 'vegetarian') {
        ingredientList = filterNonVegetarianIngredients(ingredientList);
    }

    if (ingredientList.length === 0) {
        return res.status(400).json({ error: 'No valid vegetarian ingredients were provided.' });
    }

    const ingredientsString = ingredientList.join(',');

    try {
        const response = await axios.get(
            `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${ingredientsString}&apiKey=${SPOONACULAR_API_KEY}${diet ? `&diet=${diet}` : ''}`
        );

        // Check if rate limit was exceeded
        const rateLimitError = checkRateLimit(response);
        if (rateLimitError) {
            return res.status(429).json({ error: rateLimitError });
        }

        if (response.data.length === 0) {
            return res.status(404).send('No recipes found.');
        }

        // Prepare output for the browser
        const detailedRecipes = await Promise.all(response.data.map(async recipe => {
            const recipeDetailResponse = await axios.get(`https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=${SPOONACULAR_API_KEY}`);

            // Check if rate limit was exceeded for detailed recipe fetch
            const rateLimitErrorDetail = checkRateLimit(recipeDetailResponse);
            if (rateLimitErrorDetail) {
                return null; // Skip this recipe if rate limit is exceeded for details
            }

            let { title, readyInMinutes, instructions, extendedIngredients } = recipeDetailResponse.data;
            title = cleanRecipeName(title);
            const usedIngredients = extendedIngredients.map(ing => ing.name).join(', ');

            return `Recipe Name: ${title}\nCooking Time: ${readyInMinutes} minutes\nIngredients: ${usedIngredients}\nInstructions: ${instructions}\n\n`;
        }));

        const filteredRecipes = detailedRecipes.filter(recipe => recipe !== null);

        if (filteredRecipes.length === 0) {
            return res.status(404).send('No suitable recipes found.');
        }

        const recipesOutput = filteredRecipes.join('\n\n');

        // Send the formatted output
        res.send(`<pre>${recipesOutput}</pre>`);

    } catch (error) {
        console.error('Error fetching recipes:', error.message);
        res.status(500).json({ error: 'Error fetching recipes from API.' });
    }
};
